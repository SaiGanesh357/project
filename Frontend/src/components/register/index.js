import { Component } from "react";
import { Navigate ,Link} from "react-router-dom";
import Cookies from "js-cookie"
import "./index.css"
class Register extends Component {
  state = { name: "", pass: "", message: "", loading: false };

  onsubmit = async (event) => {
    event.preventDefault();
    this.setState({ loading: true, message: "" });

    const link = "http://localhost:3001/register";
    const { name, pass } = this.state;
    const details = { username: name, password: pass };
    if(name==="" || pass===""){
      this.setState({message:"Please Enter Details",loading:false});
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
        this.setState({
          message: response.ok ? "Registered successfully" : data.error || "Server error",
        });
      } else {
        const text = await response.text();
        this.setState({ message: response.ok ? "Registered" : text || "Server error" });
      }
    } catch (err) {
      this.setState({ message: "Network error" });
    } finally {
      this.setState({ loading: false });
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
    const { name, pass, message, loading } = this.state;
    const token = Cookies.get("JwtToken");
        if (token !== undefined) {
          return <Navigate to="/" replace />;
        }
    return (
      <div className="div">
      <div className="width1" style={{boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <h2 style={{ margin: "0 0 12px 0" }}>Register</h2>
        <form onSubmit={this.onsubmit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Username</label>
            <input value={name} onChange={this.changename} type="text" style={{ width: "100%", padding: 8, borderRadius: 6 }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Password</label>
            <input value={pass} onChange={this.changepass} type="password" style={{ width: "100%", padding: 8, borderRadius: 6 }} />
          </div>
         <div className="align">
          <button type="submit" disabled={loading} style={{ padding: "8px 14px", borderRadius: 6 }}>
            {loading ? "Registering..." : "Register"}
          </button>
          <Link to="/login" >Already Have an account...?</Link>
         </div>
        </form>

        {message && <div style={{ marginTop: 12, color: "crimson" }}>{message}</div>}
      </div>
      </div>
    );
  }
}

export default Register;
