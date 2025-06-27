export const getEventOrganizerDetailsQuery = `
SELECT e.organizer_id, e.organizer_name, e.organization_name 
FROM event_organizers e 
WHERE e.user_id = $1;
`;
