import React, { useState } from 'react';
import useCustomFetch from '../hooks/useCustomFetch'; // Import the useCustomFetch hook

const EmployeeFilter = ({ onFilter }) => {
  const [location, setLocation] = useState('');
  const { fetchData } = useCustomFetch(); // Destructure fetchData from the hook

  const handleFilter = async () => {
    const { data } = await fetchData(`/employees?location=${location}`);
    onFilter(data);
  };

  return (
    <div>
      <h2>Employee Filter</h2>
      <label>
        Location:
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <button onClick={handleFilter}>Filter Employees</button>
    </div>
  );
};

export default EmployeeFilter;
