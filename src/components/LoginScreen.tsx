import React, { useState, useEffect } from 'react';
import liff from '@line/liff';

interface LoginScreenProps {
    onLogin: (username: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [guestName, setGuestName] = useState("");
    const [isLiffInit, setIsLiffInit] = useState(false);

    useEffect(() => {
        const liffId = import.meta.env.VITE_LIFF_ID || "2009183123-VjyOYar4";
        liff.init({ liffId })
            .then(() => {
                setIsLiffInit(true);
                if (liff.isLoggedIn()) {
                    liff.getProfile().then(profile => {
                        onLogin(profile.displayName);
                    });
                }
            })
            .catch((err) => {
                console.error("LIFF initialization failed", err);
            });
    }, [onLogin]);

    const handleGuestLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (guestName.trim()) {
            onLogin(guestName);
        }
    };

    const handleLineLogin = () => {
        if (!isLiffInit) {
            alert('LIFF 尚未初始化成功');
            return;
        }
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            liff.getProfile().then(profile => {
                onLogin(profile.displayName);
            });
        }
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
                        disabled={!isLiffInit}
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
