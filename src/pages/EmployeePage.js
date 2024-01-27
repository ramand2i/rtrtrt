import React from 'react';
import EmployeeForm from '../components/EmployeeForm';
import EmployeeList from '../components/EmployeeList';

const EmployeePage = () => {
  return (
    <div>
      <h2>Employee Page</h2>
      <EmployeeForm />
      <EmployeeList />
    </div>
  );
};

export default EmployeePage;
