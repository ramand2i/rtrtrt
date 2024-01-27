import React from 'react';
import AuthForm from '../components/AuthForm';

const AuthPage = () => {
  return (
    <div>
      <h2>Authentication Page</h2>
      <AuthForm type="login" onSuccess={() => console.log('Login successful!')} />
      <AuthForm type="signup" onSuccess={() => console.log('Signup successful!')} />
    </div>
  );
};

export default AuthPage;
