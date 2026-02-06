import api from "./axios.js";

export const getUsers = async () => {
  const response = await api.get("/users");
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/users/me");
  return response.data;
};
