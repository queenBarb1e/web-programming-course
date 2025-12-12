import axios from "axios";
import type { AxiosRequestConfig } from "axios";


const apiClient = axios.create({
  baseURL: (import.meta as unknown as {env: Record<string, any>} ).env?.VITE_API_URL || 'http://localhost:3000',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      console.warn('Unauthorized - token removed');
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export const customFetch = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const promise = apiClient({
    ...config,
    ...options,
  }).then(({ data }) => data);

  return promise;
};
