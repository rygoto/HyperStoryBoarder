import React from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginButton = () => {
  const { user, loading, error, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        padding: '8px 16px',
        fontSize: '14px',
        color: '#666'
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid #f3f3f3',
          borderTop: '2px solid #666',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        読み込み中...
      </div>
    );
  }

  if (user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <img
          src={user.photoURL}
          alt="Profile"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px solid #e0e0e0'
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '500', color: '#333' }}>
            {user.displayName}
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {user.email}
          </span>
        </div>
        <button
          onClick={signOut}
          style={{
            padding: '6px 12px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '8px 12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          エラー: {error}
        </div>
      )}
      <button
        onClick={signInWithGoogle}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          backgroundColor: '#4285f4',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          opacity: loading ? 0.7 : 1
        }}
        onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#3367d6')}
        onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#4285f4')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Googleでログイン
      </button>
    </div>
  );
};

export default LoginButton;