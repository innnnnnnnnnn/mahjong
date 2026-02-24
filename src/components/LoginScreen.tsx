import React, { useState } from 'react';

interface LoginScreenProps {
    onLogin: (username: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [guestName, setGuestName] = useState("");

    const handleGuestLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (guestName.trim()) {
            onLogin(guestName);
        }
    };

    const handleLineLogin = () => {
        alert('LINE 登入尚未設定 NEXT_PUBLIC_LIFF_ID，目前僅展示用。請使用訪客登入 (快速試玩)。');
    };

    return (
        <div className="login-screen-container">
            <div className="login-card">
                <h1 className="login-title">
                    台灣十六張麻將
                </h1>
                <p className="login-subtitle">Taiwan Mahjong 16 Online</p>

                <div className="login-form-container">
                    <form onSubmit={handleGuestLogin} className="guest-login-form">
                        <div className="form-label">快速試玩 (訪客登入)</div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="輸入暱稱..."
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="login-input"
                            />
                            <button
                                type="submit"
                                className="btn-start"
                            >
                                開始!
                            </button>
                        </div>
                    </form>

                    <div className="form-label social-label">或使用社群帳號 (實際登入)</div>

                    <button
                        onClick={handleLineLogin}
                        className="btn-line"
                    >
                        <span className="line-icon">💬</span>
                        <span>使用 LINE 帳號登入</span>
                    </button>
                </div>

                <div className="login-footer">
                    登入即表示您同意服務條款。
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
