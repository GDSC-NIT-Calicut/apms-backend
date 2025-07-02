export const getEventOrganizerDetailsQuery = `
SELECT e.organizer_id, e.organizer_name, e.organization_name 
FROM event_organizers e 
WHERE e.user_id = $1;
`;
export const insertAllocationQuery = `
  INSERT INTO event_organizer_allocations
    (organizer_id, file_path, status, event_name, event_type, event_date)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING *;
`;

// Only allocated
export const getAllocatedAllocationsByOrganizerQuery = `
  SELECT * FROM event_organizer_allocations
  WHERE organizer_id = $1 AND status = 'allocated'
  ORDER BY allocation_date DESC;
`;

// Only revoked
export const getRevokedAllocationsByOrganizerQuery = `
  SELECT * FROM event_organizer_allocations
  WHERE organizer_id = $1 AND status = 'revoked'
  ORDER BY allocation_date DESC;
`;



export const revokeAllocationQuery = `
  UPDATE event_organizer_allocations
  SET status = 'revoked'
  WHERE allocation_id = $1
  RETURNING *;
`;

export const getAllocationByIdQuery = `
  SELECT * FROM event_organizer_allocations
  WHERE allocation_id = $1 AND organizer_id = $2;
`;

export const getOrganizerIdByUserIdQuery = `
  SELECT organizer_id FROM event_organizers
  WHERE user_id = $1;
`;

export const bulkInsertStudentPointsQuery = `
  INSERT INTO student_points
    (student_roll_number, event_name, event_type, points, status, event_date)
  VALUES ($1, $2, $3, $4, 'APPROVED', $5)
`;

export const deleteStudentPointsByEventAndRollNumbersQuery = `
  DELETE FROM student_points
  WHERE event_name = $1 AND event_date = $2 AND student_roll_number = ANY($3::varchar[])
  AND status = 'APPROVED'
`;


export const updateAllocationDetailsQuery = `
 UPDATE event_organizer_allocations
       SET 
         file_path = $1,
         status = 'allocated',
         event_name = $2,
         event_type = $3,
         event_date = $4,
         allocation_date = NOW()
       WHERE allocation_id = $5
       RETURNING *;

`;
export const updateStudentPointsQuery = `
  UPDATE student_points
  SET 
    event_name = COALESCE($1, event_name),
    event_type = COALESCE($2, event_type),
    event_date = COALESCE($3, event_date)
  WHERE student_roll_number = $4
    AND event_name = $5
    AND event_date = $6
    AND status = 'APPROVED'
`;
export const updateevnetdetails = `
 UPDATE event_organizer_allocations
       SET 
         event_name = $1,
         event_type = $2,
         event_date = $3,
         allocation_date = NOW()
       WHERE allocation_id = $4
       RETURNING *;

`;
