import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check for both admin and attendant tokens
  const adminToken = localStorage.getItem("authToken");
  const attendantToken = localStorage.getItem("attendantToken");
  const token = attendantToken || adminToken;
  
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (data !== undefined) {
    console.log(`[API] ${method} ${url}`, { payload: data });
  } else {
    console.log(`[API] ${method} ${url}`);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  const resClone = res.clone();
  resClone.json().then(body => {
    console.log(`[API] ${method} ${url} → ${res.status}`, body);
  }).catch(() => {
    console.log(`[API] ${method} ${url} → ${res.status} (non-JSON body)`);
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Check for both admin and attendant tokens
    const adminToken = localStorage.getItem("authToken");
    const attendantToken = localStorage.getItem("attendantToken");
    const token = attendantToken || adminToken;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity for better cache management
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
