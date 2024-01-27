import React, { useState } from 'react';
import useCustomFetch from '../hooks/useCustomFetch';

const DepartmentForm = () => {
  const [name, setName] = useState('');

  const { fetchData } = useCustomFetch('/departments', 'POST', { name });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData();
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <label>
        Department Name:
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit">Create Department</button>
    </form>
  );
};

export default DepartmentForm;
