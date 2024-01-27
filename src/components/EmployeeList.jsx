import React, { useState } from 'react';
import useCustomFetch from '../hooks/useCustomFetch';
import EmployeeDetails from './EmployeeDetails';
import EmployeeFilter from './EmployeeFilter';
import AssignDepartmentForm from './AssignDepartmentForm';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const { data: allEmployees, loading, error } = useCustomFetch('/employees');

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  const handleFilter = (filteredEmployees) => {
    setEmployees(filteredEmployees);
    setSelectedEmployee(null);
  };

  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
  };

  return (
    <div>
      <h2>Employee List</h2>
      <EmployeeFilter onFilter={handleFilter} />
      <ul>
        {employees.map((employee) => (
          <li key={employee._id}>
            {employee.name} - {employee.location}{' '}
            <button onClick={() => handleSelectEmployee(employee)}>Details</button>
            <AssignDepartmentForm
              employeeId={employee._id}
              onSuccess={() => handleFilter(allEmployees)}
            />
          </li>
        ))}
      </ul>
      <EmployeeDetails employee={selectedEmployee} />
    </div>
  );
};

export default EmployeeList;
