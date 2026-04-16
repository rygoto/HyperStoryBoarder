import './App.css'
import StoryboardManager from './components/StoryboardManager'
import LoginButton from './components/LoginButton'
import { useAuth } from './hooks/useAuth'

function App() {
  const { user, loading } = useAuth();

  // ローディング中の表示
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <p style={{ color: '#666', fontSize: '16px' }}>アプリを読み込み中...</p>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  // ログインしていない場合のログイン画面
  if (!user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h1 style={{
            marginBottom: '8px',
            color: '#333',
            fontSize: '28px',
            fontWeight: '600'
          }}>
            Piyopiyo StoryBoard
          </h1>
          <p style={{
            marginBottom: '32px',
            color: '#666',
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            複数デバイスで絵コンテを共有・編集できるアプリです。<br />
            Googleアカウントでログインしてください。
          </p>
          <LoginButton />
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#e8f4fd',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#0c5460'
          }}>
            <strong>機能:</strong><br />
            • 複数デバイスでリアルタイム同期<br />
            • 画像アップロードと保存<br />
            • シーンデータの自動バックアップ
          </div>
        </div>
      </div>
    );
  }

  // ログイン済みの場合のメインアプリ
  return (
    <>
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: '600',
          color: '#333'
        }}>
          Piyopiyo StoryBoard
        </h1>
        <LoginButton />
      </header>
      <StoryboardManager />
    </>
  )
}

export default App
