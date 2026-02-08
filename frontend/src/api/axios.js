import axios from "axios";

const api = axios.create({
  // baseURL: "http://localhost:5000/api",
  baseURL: "https://smart-collaboration.onrender.com/api",
});
const api2 = axios.create({
  // baseURL: "http://localhost:5000/api",
  baseURL: "https://smart-collaboration-fastapi.onrender.com/",
});
api.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export default api;
export { api2 };
