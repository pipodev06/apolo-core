export const generateTicketCode = (series: string, counter: number): string => {
  const paddedCounter = String(counter).padStart(4, "0");
  return `${series}-${paddedCounter}`;
};
