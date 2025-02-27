import {
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
} from 'tldraw';
import { useState, useEffect } from 'react';

// Local storage key
export const GOAL_STORAGE_KEY = 'brainstorming-goal';

export const SystemGoalDialog = ({ onClose }: { onClose(): void }) => {
  // Initialize state with empty string, will be updated in useEffect
  const [goal, setGoal] = useState('');

  // Load goal from localStorage on component mount
  useEffect(() => {
    const savedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    if (savedGoal) {
      setGoal(savedGoal);
    }
  }, []);

  const handleSubmit = () => {
    // Save goal to localStorage
    localStorage.setItem(GOAL_STORAGE_KEY, goal);
    onClose();
  };

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>Brainstorming Goal</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 350 }}>
        <textarea
          className='w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px] font-sans'
          placeholder='Enter a goal for the brainstorming session'
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={5}
          autoFocus
        />
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter className='tlui-dialog__footer__actions'>
        <TldrawUiButton type='normal' onClick={onClose}>
          <TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
        </TldrawUiButton>
        <TldrawUiButton
          type='primary'
          onClick={handleSubmit}
          disabled={!goal.trim()}
        >
          <TldrawUiButtonLabel>Save</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  );
};
