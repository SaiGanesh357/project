import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Login from "./components/login";
import Register from "./components/register";
import Students from "./components/students";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/students" element={<Students />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
