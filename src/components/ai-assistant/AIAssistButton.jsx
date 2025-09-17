import React from 'react';

const AIAssistButton = ({ pageIdx, cutIdx, onAIAssist }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAIAssist(pageIdx, cutIdx);
      }}
      style={{
        position: 'absolute',
        top: '4px',
        left: '4px',
        width: '24px',
        height: '24px',
        background: '#8b5cf6',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        cursor: 'pointer',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s'
      }}
      onMouseOver={(e) => {
        e.target.style.background = '#7c3aed';
      }}
      onMouseOut={(e) => {
        e.target.style.background = '#8b5cf6';
      }}
      title="AI補助で構図生成"
    >
      🤖
    </button>
  );
};

export default AIAssistButton; 