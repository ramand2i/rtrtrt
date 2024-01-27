import React, { useState } from 'react';
import useCustomFetch from '../hooks/useCustomFetch';

const AssignDepartmentForm = ({ employeeId, onSuccess }) => {
  const [departmentId, setDepartmentId] = useState('');

  const { fetchData } = useCustomFetch(`/employees/${employeeId}/assign`, 'POST', { departmentId });

  const handleAssignDepartment = async () => {
    await fetchData();
    onSuccess();
  };

  return (
    <div>
      <h2>Assign Department</h2>
      <label>
        Department ID:
        <input type="text" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} />
      </label>
      <button onClick={handleAssignDepartment}>Assign Department</button>
    </div>
  );
};

export default AssignDepartmentForm;
