component(shape: LinkShape) {
  const {
    url,
    text,
    isLoading,
    error,
    previewImageUrl,
    description,
    tempUrl,
  } = shape.props;

  const isEditing = this.editor.getEditingShapeId() === shape.id;

  // Function to handle external link click
  const handleExternalLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <HTMLContainer
      style={{
        width: '100%',
        height: '100%',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        pointerEvents: 'all', // Allow pointer events
      }}
    >
      {/* External link icon in top-right corner */}
      <div 
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          cursor: 'pointer',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '4px',
          padding: '4px',
        }}
        onClick={handleExternalLinkClick}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      
      {previewImageUrl && (
        // ... existing code ...
      )}

      <div
        style={{
          padding: '12px',
          flexGrow: previewImageUrl ? 1 : 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {!isEditing ? (
            <a
              href={url}
              target='_blank'
              rel='noopener noreferrer'
              style={{
                color: '#1a73e8',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '14px',
                display: 'block',
                marginBottom: '4px',
                wordBreak: 'break-word',
              }}
            >
              {text}
            </a>
          ) : (
            // ... existing code ...
          )}

          {/* ... existing code ... */}
        </div>

        <div
          style={{
            fontSize: '11px',
            color: '#888',
            marginTop: '8px',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ marginRight: '4px', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {url}
          </span>
          <button
            onClick={handleExternalLinkClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 3H21V9" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 14L21 3" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ... existing code ... */}
    </HTMLContainer>
  );
} 