import React, { useState } from 'react';
import useCustomFetch from '../hooks/useCustomFetch';

const EmployeeForm = () => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const { fetchData } = useCustomFetch('/employees', 'POST', { name, location, departmentId });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData();
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <label>
        Employee Name:
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Location:
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label>
        Department ID:
        <input type="text" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} />
      </label>
      <button type="submit">Create Employee</button>
    </form>
  );
};

export default EmployeeForm;
