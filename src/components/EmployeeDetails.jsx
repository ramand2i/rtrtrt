import React from 'react';

const EmployeeDetails = ({ employee }) => {
  if (!employee) {
    return <p>No employee selected.</p>;
  }

  return (
    <div>
      <h2>Employee Details</h2>
      <p>Name: {employee.name}</p>
      <p>Location: {employee.location}</p>
      <p>Department: {employee.department}</p>
    </div>
  );
};

export default EmployeeDetails;
