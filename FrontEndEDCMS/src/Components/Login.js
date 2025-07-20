import React, { useState } from 'react';
import '../Styling/log_user.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode'; 

function LoginComponent() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://77.242.26.150:8000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || 'Login failed');
      }

      const data = await response.json();
      const token = typeof data === 'string' ? data : data.token;

      const payload = jwtDecode(token);
      console.log('Decoded JWT payload:', payload);

      localStorage.setItem('token', token);

      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };


  return (
    <div className='log_main_div'>
      <form onSubmit={handleSubmit}>
        <div className='log_user'>
          <a href='/'>
            <img src={`${process.env.PUBLIC_URL}/Assets/logo.png`} id='logo_login' alt='Logo' />
          </a>
          <p id='head_log'>Log in to see our fullest extent!</p>

          <input
            type='text'
            placeholder='Username or Email'
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type='password'
            placeholder='Password'
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            id='pass_input'
          />

          <a href='/forgot-password' id='forgot_pw'>Forgot Password?</a>

          <div className='remember_me'>
            <input
              type='checkbox'
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
            />
            <p>Remember Me</p>
          </div>

          <button type='submit' id='button_log' disabled={loading}>
            {loading ? 'Logging in...' : 'Done'}
          </button>

          {error && <div className='error-message'>Error: {error}</div>}
        </div>
      </form>
    </div>
  );
}

export default LoginComponent;
