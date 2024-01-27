
import React, { useState } from 'react';
import useCustomFetch from '../hooks/useCustomFetch';

const AuthForm = ({ type, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { fetchData , data, loading, error} = useCustomFetch(`/auth/${type}`, 'POST', { username, password });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData();
    
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <label>
        Username:
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label>
        Password:
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button type="submit">{type === 'signup' ? 'Sign Up' : 'Login'}</button>
    </form>
  );
};

export default AuthForm;
