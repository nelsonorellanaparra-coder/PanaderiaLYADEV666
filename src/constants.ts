export const PRODUCTS = [
  { name: 'Empanada Integral', price: 4, imageUrl: 'https://i.ibb.co/x8hyNmPy/Screenshot-1.png' },
  { name: 'Empanadas a Bs.3.5', price: 3.5, imageUrl: 'https://i.ibb.co/Mkq6QrM3/Empanadas.png' },
  { name: 'Queques', price: 15, imageUrl: 'https://i.ibb.co/60589T4N/qq.png' },
  { name: 'Rollos grandes', price: 35, imageUrl: 'https://i.ibb.co/nMgnXyTN/Rollos-de-queso-AI.png' },
  { name: 'Rollos pequeños', price: 17, imageUrl: 'https://i.ibb.co/DPLzNnhm/1234124.png' }
];

export const CATEGORIES = ['Gasto General', 'Material'];
export const PAYERS = ['Sra. Aurelia', 'Lesly'];

export const getLocalDateString = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
