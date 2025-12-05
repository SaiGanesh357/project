import { Component } from "react";
import { Navigate ,Link} from "react-router-dom";
import Cookies from "js-cookie";

class Login extends Component {
  state = { name: "", pass: "", message: "", redirect: false };

  storeJwt = (token) => {
    if (!token) return;
    Cookies.set("JwtToken", token, { expires: 50 });
    this.setState({ redirect: true });
  };

  onsubmit = async (event) => {
    event.preventDefault();
    this.setState({ message: "" });

    const link = "https://project-a1pl.onrender.com/login";
    const { name, pass } = this.state;
    const details = { username: name, password: pass };
    if(name==="" || pass===""){
       this.setState({message:"Please Enter Details"})
    }else{      
      try {
        const option = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(details),
        };

        const response = await fetch(link, option);
      const ct = response.headers.get("content-type") || "";
      
      if (ct.includes("application/json")) {
        const data = await response.json();
        if (response.ok && data.jwtToken) {
          this.storeJwt(data.jwtToken);
        } else {
          this.setState({ message: data.error || "Login failed" });
        }
      } else {
        const text = await response.text();
        this.setState({ message: response.ok ? "Logged in" : text || "Login failed" });
      }
      
      if (!response.ok) console.error("Request failed", response.status);
    } catch (err) {
      console.error("Fetch error", err);
      this.setState({ message: "Network error" });
    }
  }
  };
  
  changename = (event) => {
    this.setState({ name: event.target.value });
  };

  changepass = (event) => {
    this.setState({ pass: event.target.value });
  };

  render() {
    const { name, pass, message, redirect } = this.state;
    const token = Cookies.get("JwtToken");
    if (token !== undefined || redirect) {
      return <Navigate to="/" replace />;
    }

    return (
      <div className="div">

      <div className="width1" style={{ background: "linear-gradient(135deg,#f8f1ff,#e8f7ff)", boxShadow: "0 6px 20px rgba(0,0,0,0.12)", fontFamily: "Arial, sans-serif" }}>
        <h2 style={{ margin: "0 0 14px 0", color: "#3b2b7f" }}>Login</h2>

        <form onSubmit={this.onsubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6, color: "#333" }}>Username</label>
            <input
              type="text"
              value={name}
              onChange={this.changename}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cfc7ff", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6, color: "#333" }}>Password</label>
            <input
              type="password"
              value={pass}
              onChange={this.changepass}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cfe9ff", outline: "none", boxSizing: "border-box" }}
              />
          </div>
         <div className="align">
          <button type="submit" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "#6b46ff", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Login
          </button>
          <Link to="/register">Create a Account...?</Link>
         </div>
        </form>

        {message && <div style={{ marginTop: 12, color: "#b71c1c" }}>{message}</div>}
      </div>
              </div>
    );
  }
}

export default Login;
