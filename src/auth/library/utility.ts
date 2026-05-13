export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};
export function formatOdooDatetime(date: Date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}
