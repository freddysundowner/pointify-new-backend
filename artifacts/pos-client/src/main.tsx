import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App";
import "./index.css";
import { CartProvider } from "./contexts/CartContext";

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <CartProvider>
    <App />
    </CartProvider>
    
  </Provider>
);
