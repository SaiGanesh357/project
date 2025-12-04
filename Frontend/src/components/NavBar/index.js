import { Component } from "react";
import Cookies from "js-cookie";
import { Navigate ,Link} from "react-router-dom";
import "./index.css"

class NavBar extends Component{
    state={isout:false}
        logout = () => {
          Cookies.remove("JwtToken");
          this.setState({isout:true})
        };
    render(){
        const token = Cookies.get("JwtToken");
    
        if (token === undefined) {
          return <Navigate to="/login" replace />;
        }
        return(
            <nav className="nav">
                <h1>Head</h1>
              <div>
              <Link className="link" to="/">Home</Link>
              <Link className="link" to="/students">DashBoard</Link>
              </div>
              <button className="btn btn-outline-danger" onClick={this.logout}>Logout</button>
            </nav>
    );
  }
}

export default NavBar;