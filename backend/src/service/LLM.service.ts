import { AppContext } from '..';
import OpenAI from 'openai';
import { ZodObject } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export const LLMService = {
  STANDARD_MODEL: 'google/gemini-2.0-flash-001',
  WEB_SEARCH_MODEL: 'perplexity/sonar',

  generateMessage: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
    structuredOutput: {
      name: string;
      schema: ZodObject<any>;
    };
  }) => {
    const { prompt, chatHistory, env, structuredOutput } = params;

    // Initialize OpenAI client with API key from environment
    const openai = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      // this model has better throughput so faster
      model: LLMService.STANDARD_MODEL,
      messages: [
        ...chatHistory.map((message) => ({
          role: message.sender,
          content: message.content,
        })),
        { role: 'user', content: prompt },
      ],
      response_format: zodResponseFormat(
        structuredOutput.schema,
        structuredOutput.name
      ),
    });

    const choice = completion.choices[0];

    if (structuredOutput) {
      // @ts-ignore
      return structuredOutput.schema.parse(JSON.parse(choice.message.content));
    }

    // Extract the response text
    return choice.message.content;
  },

  streamMessage: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
    structuredOutput: {
      name: string;
      schema: ZodObject<any>;
    };
    onNewContent: (parsedContent: unknown) => void;
  }) => {
    const { prompt, chatHistory, env, structuredOutput, onNewContent } = params;

    // Initialize OpenAI client with API key from environment
    const openrouter = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // const openai = new OpenAI({
    //   apiKey: env.OPENAI_API_KEY,
    // });

    const stream = openrouter.beta.chat.completions
      .stream({
        model: LLMService.STANDARD_MODEL,
        messages: [
          ...chatHistory.map((message) => ({
            role: message.sender,
            content: message.content,
          })),
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(
          structuredOutput.schema,
          structuredOutput.name
        ),
      })
      .on('refusal.done', () => console.log('request refused'))
      .on('content.delta', ({ snapshot, parsed }) => {
        onNewContent(parsed);
      });

    await stream.done();

    const finalCompletion = await stream.finalChatCompletion();

    return finalCompletion;
  },

  /**
   * Streams a web search prompt using Perplexity's Sonar model
   * @param params
   * @returns
   */
  streamWebSearch: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
    onNewContent: (streamedContent: string) => void;
  }) => {
    const { prompt, chatHistory, env, onNewContent } = params;

    const openrouter = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    const stream = openrouter.beta.chat.completions
      .stream({
        model: LLMService.WEB_SEARCH_MODEL,
        messages: [
          ...chatHistory.map((message) => ({
            role: message.sender,
            content: message.content,
          })),
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      })
      // .on('chunk', (chunk, snapshot) => console.log('chunk', chunk, snapshot))
      .on('refusal.done', () => console.log('request refused'))
      .on('content.delta', ({ snapshot }) => {
        onNewContent(snapshot);
      })
      .on('refusal.done', (refusal) => console.log('request refused', refusal))
      .on('refusal.delta', (response) => console.log('refusal delta', response))
      .on('error', () => {});

    await stream.done();

    return stream.finalChatCompletion();
  },

  /**
   * Parses raw stream into structured format
   * @param content
   * @returns structured content
   */
  parseRawStreamIntoStructured: (params: {
    content: string;
    structuredOutput: {
      name: string;
      schema: ZodObject<any>;
    };
  }): unknown => {
    const { content, structuredOutput } = params;

    try {
      // First try to parse as JSON directly
      const parsedJson = JSON.parse(content);
      return parsedJson;
    } catch (error) {
      // If not valid JSON, try to extract structured data from XML or text format
      const result: { explanation?: string; nodes?: any[] } = {};

      // Try to extract explanation even if the XML is incomplete
      const explanationMatch = content.match(
        /<explanation>(.*?)(?:<\/explanation>|$)/s
      );
      if (explanationMatch && explanationMatch[1]) {
        result.explanation = explanationMatch[1].trim();
      }

      // Try to extract nodes even if some are incomplete
      const nodesOpenTag = content.indexOf('<nodes>');
      if (nodesOpenTag !== -1) {
        const nodesContent = content.slice(nodesOpenTag + 7); // +7 to skip '<nodes>'

        // First try to extract complete nodes
        const completeNodeRegex = /<node>(.*?)<\/node>/gs;
        const completeNodes: any[] = [];
        let nodeMatch;

        while ((nodeMatch = completeNodeRegex.exec(nodesContent)) !== null) {
          const nodeXml = nodeMatch[0];
          try {
            // Extract node data as before
            const typeMatch = nodeXml.match(/<type>(.*?)<\/type>/s);
            const type = typeMatch ? typeMatch[1].trim() : 'text';

            const textMatch = nodeXml.match(/<text>(.*?)<\/text>/s);
            const text = textMatch ? textMatch[1].trim() : '';

            const parentIdMatch = nodeXml.match(/<parentId>(.*?)<\/parentId>/s);
            let parentId = parentIdMatch ? parentIdMatch[1].trim() : null;

            if (parentId === 'null') parentId = null;
            if (parentId === 'none') parentId = 'none';

            const predictionsSection = nodeXml.match(
              /<predictions>(.*?)<\/predictions>/s
            );
            let predictions: {
              text: string;
              type: 'text' | 'web' | 'image';
            }[] = [];

            if (predictionsSection) {
              const predictionMatches = predictionsSection[1].match(
                /<prediction>(.*?)<\/prediction>/gs
              );

              if (predictionMatches) {
                predictions = predictionMatches.map((predXml) => {
                  const predTextMatch = predXml.match(/<text>(.*?)<\/text>/s);
                  const text = predTextMatch ? predTextMatch[1].trim() : '';

                  const predTypeMatch = predXml.match(/<type>(.*?)<\/type>/s);
                  const type = (
                    predTypeMatch ? predTypeMatch[1].trim() : 'text'
                  ) as 'text' | 'web' | 'image';

                  return { text, type };
                });
              }
            }

            completeNodes.push({
              type,
              text,
              parentId,
              predictions,
            });
          } catch (nodeError) {
            console.error('Error parsing complete node:', nodeError);
          }
        }

        // Now try to extract partial nodes (those without closing tags)
        // This is the key improvement - we'll look for partial nodes too
        const partialNodes: any[] = [];

        // Find all node opening tags
        const nodeOpenings = [...nodesContent.matchAll(/<node>/g)];

        for (let i = 0; i < nodeOpenings.length; i++) {
          const startPos = nodeOpenings[i].index;
          // If this is the last node or there's no complete node ending
          const nextNodeStart =
            i < nodeOpenings.length - 1 ? nodeOpenings[i + 1].index : -1;
          const nodeEndTag = nodesContent.indexOf('</node>', startPos);

          // If this node doesn't have a closing tag or the closing tag is after the next node starts
          // (meaning it's a complete node we already processed)
          if (
            nodeEndTag === -1 ||
            (nextNodeStart !== -1 && nodeEndTag > nextNodeStart)
          ) {
            // This is a partial node
            const endPos =
              nextNodeStart !== -1 ? nextNodeStart : nodesContent.length;
            const partialNodeContent = nodesContent.substring(startPos, endPos);

            try {
              // Extract whatever data is available in the partial node
              const typeMatch = partialNodeContent.match(
                /<type>(.*?)(?:<\/type>|$)/s
              );
              const type =
                typeMatch && typeMatch[1] ? typeMatch[1].trim() : 'text';

              const textMatch = partialNodeContent.match(
                /<text>(.*?)(?:<\/text>|$)/s
              );
              const text = textMatch && textMatch[1] ? textMatch[1].trim() : '';

              const parentIdMatch = partialNodeContent.match(
                /<parentId>(.*?)(?:<\/parentId>|$)/s
              );
              let parentId =
                parentIdMatch && parentIdMatch[1]
                  ? parentIdMatch[1].trim()
                  : null;

              if (parentId === 'null') parentId = null;
              if (parentId === 'none') parentId = 'none';

              // Try to extract any predictions that might be available
              const predictionsOpenTag =
                partialNodeContent.indexOf('<predictions>');
              let predictions: {
                text: string;
                type: 'text' | 'web' | 'image';
              }[] = [];

              if (predictionsOpenTag !== -1) {
                const predictionsContent = partialNodeContent.slice(
                  predictionsOpenTag + 13
                ); // +13 to skip '<predictions>'

                // Find complete predictions
                const predictionRegex = /<prediction>(.*?)<\/prediction>/gs;
                let predMatch;

                while (
                  (predMatch = predictionRegex.exec(predictionsContent)) !==
                  null
                ) {
                  const predXml = predMatch[0];

                  const predTextMatch = predXml.match(/<text>(.*?)<\/text>/s);
                  const predText =
                    predTextMatch && predTextMatch[1]
                      ? predTextMatch[1].trim()
                      : '';

                  const predTypeMatch = predXml.match(/<type>(.*?)<\/type>/s);
                  const predType = (
                    predTypeMatch && predTypeMatch[1]
                      ? predTypeMatch[1].trim()
                      : 'text'
                  ) as 'text' | 'web' | 'image';

                  if (predText) {
                    predictions.push({ text: predText, type: predType });
                  }
                }

                // Also look for partial predictions
                const predOpenings = [
                  ...predictionsContent.matchAll(/<prediction>/g),
                ];

                for (let j = 0; j < predOpenings.length; j++) {
                  const predStartPos = predOpenings[j].index;
                  const nextPredStart =
                    j < predOpenings.length - 1
                      ? predOpenings[j + 1].index
                      : -1;
                  const predEndTag = predictionsContent.indexOf(
                    '</prediction>',
                    predStartPos
                  );

                  // If this is a partial prediction
                  if (
                    predEndTag === -1 ||
                    (nextPredStart !== -1 && predEndTag > nextPredStart)
                  ) {
                    const predEndPos =
                      nextPredStart !== -1
                        ? nextPredStart
                        : predictionsContent.length;
                    const partialPredContent = predictionsContent.substring(
                      predStartPos,
                      predEndPos
                    );

                    const partialPredTextMatch = partialPredContent.match(
                      /<text>(.*?)(?:<\/text>|$)/s
                    );
                    const partialPredText =
                      partialPredTextMatch && partialPredTextMatch[1]
                        ? partialPredTextMatch[1].trim()
                        : '';

                    const partialPredTypeMatch = partialPredContent.match(
                      /<type>(.*?)(?:<\/type>|$)/s
                    );
                    const partialPredType = (
                      partialPredTypeMatch && partialPredTypeMatch[1]
                        ? partialPredTypeMatch[1].trim()
                        : 'text'
                    ) as 'text' | 'web' | 'image';

                    if (partialPredText) {
                      predictions.push({
                        text: partialPredText,
                        type: partialPredType,
                      });
                    }
                  }
                }
              }

              // Only add the partial node if it has some meaningful content
              if (text) {
                partialNodes.push({
                  type,
                  text,
                  parentId,
                  predictions,
                });
              }
            } catch (partialNodeError) {
              console.error('Error parsing partial node:', partialNodeError);
            }
          }
        }

        // Combine complete and partial nodes, avoiding duplicates
        // We'll consider nodes with the same text content as duplicates
        const allNodes = [...completeNodes];

        for (const partialNode of partialNodes) {
          // Check if this partial node is already included in complete nodes
          const isDuplicate = completeNodes.some(
            (node) =>
              node.text === partialNode.text &&
              node.parentId === partialNode.parentId
          );

          if (!isDuplicate) {
            allNodes.push(partialNode);
          }
        }

        if (allNodes.length > 0) {
          result.nodes = allNodes;
        }
      }

      // If we extracted any structured data, return it
      if (result.explanation || (result.nodes && result.nodes.length > 0)) {
        return result;
      }

      // Fall back to text-based parsing if XML parsing fails
      // (rest of the code remains the same)
      const textExplanationMatch = content.match(
        /explanation:(.*?)(?=nodes:|$)/s
      );
      if (textExplanationMatch) {
        result.explanation = textExplanationMatch[1].trim();
      }

      // Look for nodes section
      const nodesMatch = content.match(/nodes:(.*?)(?=$)/s);
      if (nodesMatch) {
        // Try to parse nodes from text
        const nodesText = nodesMatch[1].trim();

        // Look for node patterns like "## Node title"
        const nodeMatches = nodesText.match(/##\s*(.*?)(?=##|$)/gs);

        if (nodeMatches) {
          result.nodes = nodeMatches.map((nodeText, index) => {
            const titleMatch = nodeText.match(/##\s*(.*?)(?=\n|$)/);
            const title = titleMatch ? titleMatch[1].trim() : '';

            // Remove the title from the content
            let nodeContent = nodeText.replace(/##\s*(.*?)(?=\n|$)/, '').trim();

            // Extract predictions if they exist
            const predictionsMatch = nodeContent.match(
              /Predictions:(.*?)(?=$)/s
            );
            let predictions: {
              text: string;
              type: 'text' | 'web' | 'image';
            }[] = [];

            if (predictionsMatch) {
              const predictionText = predictionsMatch[1].trim();
              const predictionItems = predictionText.match(
                /[-*]\s*(.*?)(?=[-*]|$)/gs
              );

              if (predictionItems) {
                predictions = predictionItems.map((item) => {
                  const cleanItem = item.replace(/[-*]\s*/, '').trim();

                  // Determine prediction type based on content
                  let type: 'text' | 'web' | 'image' = 'text';
                  if (
                    cleanItem.toLowerCase().includes('search') ||
                    cleanItem.toLowerCase().includes('find') ||
                    cleanItem.toLowerCase().includes('latest')
                  ) {
                    type = 'web';
                  } else if (
                    cleanItem.toLowerCase().includes('image') ||
                    cleanItem.toLowerCase().includes('visual') ||
                    cleanItem.toLowerCase().includes('picture')
                  ) {
                    type = 'image';
                  }

                  return { text: cleanItem, type };
                });
              }

              // Remove predictions section from content
              nodeContent = nodeContent
                .replace(/Predictions:(.*?)(?=$)/s, '')
                .trim();
            }

            return {
              type: 'text',
              text: `## ${title}\n\n${nodeContent}`,
              parentId: index === 0 ? null : 'none',
              predictions,
            };
          });
        }
      }

      // Return whatever structured data we could extract
      return result;
    }
  },
};
