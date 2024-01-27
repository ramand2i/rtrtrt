// /client/src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import DepartmentPage from './pages/DepartmentPage';
import EmployeePage from './pages/EmployeePage';

const App = () => {

  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <div>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/departments"
            element={
              isAuthenticated ? <DepartmentPage /> : <Navigate to="/auth" />
            }
          />
          <Route
            path="/employees"
            element={
              isAuthenticated ? <EmployeePage /> : <Navigate to="/auth" />
            }
          />

          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/departments" /> : <Navigate to="/auth" />
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
