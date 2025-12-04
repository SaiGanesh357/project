import React, { Component } from "react";
import Cookies from "js-cookie";
import * as XLSX from "xlsx";
import NavBar from "../NavBar";
import "./index.css";

export default class Students extends Component {
  state = {
    students: [],
    loading: false,
    msg: "",
    showAdd: false,
    newName: "",
    newRoll: "",
    editingId: null,
    editValues: {},
    parsedPreview: null,
    search: "",
  };

  componentDidMount() {
    this.fetchStudents();
  }

  getAuthHeaders() {
    const token = Cookies.get("JwtToken");
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }

  fetchStudents = async () => {
    try {
      this.setState({ loading: true, msg: "" });
      const res = await fetch("http://localhost:3001/students", {
        method: "GET",
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed: ${res.status}`);
      }
      const data = await res.json();
      this.setState({ students: data || [] });
    } catch (err) {
      console.error(err);
      this.setState({ msg: "Failed to load students" });
    } finally {
      this.setState({ loading: false });
    }
  };

  addStudentApi = async (name, roll_number) => {
    const res = await fetch("http://localhost:3001/add-student", {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name, roll_number }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Add failed: ${res.status}`);
    }
    return true;
  };

  updateStudentApi = async (id, payload) => {
    const res = await fetch(`http://localhost:3001/students/${id}`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Update failed: ${res.status}`);
    }
    return true;
  };

  deleteStudentApi = async (id) => {
    const res = await fetch(`http://localhost:3001/students/${id}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Delete failed: ${res.status}`);
    }
    return true;
  };

  onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) this.parseAndImportFile(f);
    e.target.value = "";
  };

  parseAndImportFile = async (file) => {
    if (!file) return;
    this.setState({ loading: true, msg: "", parsedPreview: null });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!raw.length) {
        this.setState({ msg: "Uploaded file is empty", loading: false });
        return;
      }

      const normalizeKey = (k) => k.trim().toLowerCase().replace(/[\s\-_]/g, "");
      const activityKeyMatch = (k) => {
        const nk = normalizeKey(k);
        const m =
          nk.match(/(?:activity|act|a)?0*([1-5])$/) ||
          nk.match(/^(?:activity|act|a)([1-5])$/) ||
          nk.match(/^([1-5])$/);
        if (m) return `activity${m[1]}`;
        return null;
      };

      const parsed = raw.map((row, i) => {
        const out = { __row: i + 2 };
        for (const rawKey of Object.keys(row)) {
          const val = row[rawKey];
          const nk = normalizeKey(rawKey);
          if (nk === "name" || nk === "studentname" || nk === "student") out.name = String(val).trim();
          else if (nk === "roll" || nk === "rollnumber" || nk === "roll_number" || nk === "id")
            out.roll_number = String(val).trim();
          else {
            const actKey = activityKeyMatch(rawKey);
            if (actKey) out[actKey] = String(val).trim();
          }
        }
        return out;
      });

      const shaped = parsed.map((r) => ({
        __row: r.__row,
        name: r.name ?? "",
        roll_number: r.roll_number ?? "",
        activity1: r.activity1 ?? "",
        activity2: r.activity2 ?? "",
        activity3: r.activity3 ?? "",
        activity4: r.activity4 ?? "",
        activity5: r.activity5 ?? "",
      }));

      this.setState({ parsedPreview: shaped, msg: `Parsed ${shaped.length} rows — importing...` });

      await this.fetchStudents();
      const existingMap = {};
      this.state.students.forEach((s) => {
        if (s.roll_number) existingMap[s.roll_number] = s;
      });

      const createFailures = [];
      for (const r of shaped) {
        if (!r.name || !r.roll_number) {
          createFailures.push({ row: r.__row, roll: r.roll_number, error: "Missing name or roll" });
          continue;
        }
        if (!existingMap[r.roll_number]) {
          try {
            await this.addStudentApi(r.name, r.roll_number);
            existingMap[r.roll_number] = true;
          } catch (err) {
            createFailures.push({ row: r.__row, roll: r.roll_number, error: String(err.message || err) });
          }
        }
      }

      await this.fetchStudents();
      const updatedMap = {};
      this.state.students.forEach((s) => (updatedMap[s.roll_number] = s));

      const updateResults = [];
      for (const r of shaped) {
        const target = updatedMap[r.roll_number];
        if (!target) {
          updateResults.push({ ok: false, row: r.__row, roll: r.roll_number, error: "Missing after create" });
          continue;
        }
        const payload = {
          name: r.name || target.name,
          roll_number: r.roll_number,
          activity1: r.activity1 !== "" ? r.activity1 : target.activity1 ?? "",
          activity2: r.activity2 !== "" ? r.activity2 : target.activity2 ?? "",
          activity3: r.activity3 !== "" ? r.activity3 : target.activity3 ?? "",
          activity4: r.activity4 !== "" ? r.activity4 : target.activity4 ?? "",
          activity5: r.activity5 !== "" ? r.activity5 : target.activity5 ?? "",
        };

        try {
          await this.updateStudentApi(target.id, payload);
          updateResults.push({ ok: true, row: r.__row, roll: r.roll_number });
        } catch (err) {
          updateResults.push({ ok: false, row: r.__row, roll: r.roll_number, error: String(err.message || err) });
        }
      }

      // const createdCount = Object.keys(updatedMap).length - Object.keys(existingMap).length;
      const createdFailCount = createFailures.length;
      const updatedOK = updateResults.filter((x) => x.ok).length;
      const updatedFail = updateResults.filter((x) => !x.ok).length;

      let summary = `Import complete — processed ${shaped.length} rows. Updated ${updatedOK}, updateFailed ${updatedFail}.`;
      if (createdFailCount) summary += ` Create failed: ${createdFailCount}.`;
      if (createdFailCount > 0) summary += ` Check server response or duplicate roll numbers.`;

      this.setState({ msg: summary, parsedPreview: null });
      await this.fetchStudents();
    } catch (err) {
      console.error(err);
      this.setState({ msg: "Parse/import failed: " + (err.message || err) });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleAddSubmit = async (e) => {
    e.preventDefault();
    const { newName, newRoll } = this.state;
    if (!newName.trim() || !newRoll.trim()) return this.setState({ msg: "Name and roll required" });
    try {
      this.setState({ loading: true, msg: "" });
      await this.addStudentApi(newName.trim(), newRoll.trim());
      this.setState({ msg: "Student added", newName: "", newRoll: "", showAdd: false });
      await this.fetchStudents();
    } catch (err) {
      this.setState({ msg: err.message || "Add failed" });
    } finally {
      this.setState({ loading: false });
    }
  };

  startEdit = (s) => {
    this.setState({
      editingId: s.id,
      editValues: {
        name: s.name ?? "",
        roll_number: s.roll_number ?? "",
        activity1: s.activity1 ?? "",
        activity2: s.activity2 ?? "",
        activity3: s.activity3 ?? "",
        activity4: s.activity4 ?? "",
        activity5: s.activity5 ?? "",
      },
      msg: "",
    });
  };

  cancelEdit = () => {
    this.setState({ editingId: null, editValues: {}, msg: "" });
  };

  changeEdit = (key) => (e) => {
    this.setState((s) => ({ editValues: { ...s.editValues, [key]: e.target.value } }));
  };

  saveRow = async (s) => {
    const { editValues } = this.state;
    if (!editValues.name?.trim() || !editValues.roll_number?.trim()) {
      return this.setState({ msg: "Name and Roll are required" });
    }
    try {
      this.setState({ loading: true, msg: "" });
      await this.updateStudentApi(s.id, {
        name: editValues.name.trim(),
        roll_number: editValues.roll_number.trim(),
        activity1: editValues.activity1 ?? "",
        activity2: editValues.activity2 ?? "",
        activity3: editValues.activity3 ?? "",
        activity4: editValues.activity4 ?? "",
        activity5: editValues.activity5 ?? "",
      });
      this.setState({ msg: "Updated successfully", editingId: null, editValues: {} });
      await this.fetchStudents();
    } catch (err) {
      console.error(err);
      this.setState({ msg: err.message || "Update failed" });
    } finally {
      this.setState({ loading: false });
    }
  };

  deleteStudent = async (id) => {
    if (!window.confirm("Delete this student? This action cannot be undone.")) return;
    try {
      this.setState({ loading: true, msg: "" });
      await this.deleteStudentApi(id);
      this.setState({ msg: "Deleted" });
      await this.fetchStudents();
    } catch (err) {
      console.error(err);
      this.setState({ msg: err.message || "Delete failed" });
    } finally {
      this.setState({ loading: false });
    }
  };

  downloadCSV = () => {
    const { students } = this.state;
    if (!students.length) return this.setState({ msg: "No students to export" });
    const header = ["Name", "Roll", "Activity1", "Activity2", "Activity3", "Activity4", "Activity5"];
    const rows = students.map((s) => [
      s.name || "",
      s.roll_number || "",
      s.activity1 ?? "",
      s.activity2 ?? "",
      s.activity3 ?? "",
      s.activity4 ?? "",
      s.activity5 ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  renderPreviewTable = () => {
    const { parsedPreview } = this.state;
    if (!parsedPreview) return null;
    return (
      <div style={{ margin: "12px 0", border: "1px dashed #ccc", padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>Parsed Preview (first 50 rows)</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left" }}>
                <th style={{ padding: 6 }}>Row</th>
                <th style={{ padding: 6 }}>Name</th>
                <th style={{ padding: 6 }}>Roll</th>
                <th style={{ padding: 6 }}>Act1</th>
                <th style={{ padding: 6 }}>Act2</th>
                <th style={{ padding: 6 }}>Act3</th>
                <th style={{ padding: 6 }}>Act4</th>
                <th style={{ padding: 6 }}>Act5</th>
              </tr>
            </thead>
            <tbody>
              {parsedPreview.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: 6 }}>{r.__row}</td>
                  <td style={{ padding: 6 }}>{r.name}</td>
                  <td style={{ padding: 6 }}>{r.roll_number}</td>
                  <td style={{ padding: 6 }}>{r.activity1}</td>
                  <td style={{ padding: 6 }}>{r.activity2}</td>
                  <td style={{ padding: 6 }}>{r.activity3}</td>
                  <td style={{ padding: 6 }}>{r.activity4}</td>
                  <td style={{ padding: 6 }}>{r.activity5}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  change = (event) => {
    this.setState({ search: event.target.value });
  };

  render() {
    const {
      students,
      loading,
      msg,
      showAdd,
      newName,
      newRoll,
      editingId,
      editValues,
      parsedPreview,
      search,
    } = this.state;
    const wrap = { maxWidth: 1100, margin: "20px auto", fontFamily: "Arial, sans-serif", padding: 16 };
    const plusBtn = { width: 36, height: 36, borderRadius: 18, border: "none", background: "#2b7a78", color: "#fff", cursor: "pointer", fontSize: 20 };
    const input = { padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", width: "100%", minWidth: 120 };
    const smallMuted = { color: "#666", fontSize: 13 };

    let data = Array.isArray(students) ? students.slice() : [];

    const q = (search || "").trim().toLowerCase();
    if (q) {
      data = data.filter((s) => {
        const name = (s.name || "").toLowerCase();
        const roll = (s.roll_number || "").toLowerCase();
        return name.includes(q) || roll.includes(q);
      });
    }

    return (
      <>
        <NavBar />
        <div className="searchBox">
          <input placeholder="Search" onChange={this.change} className="search" type="search" value={search} />
        </div>
        <div style={wrap}>
          <div className="flex-items">
            <div className="main">
              <button title="Add student" onClick={() => this.setState({ showAdd: !showAdd })} style={plusBtn}>
                +
              </button>
              <h2 style={{ margin: 0 }}>Students</h2>
              <input type="file" accept=".csv, .xlsx, .xls" onChange={this.onFileChange} style={{ marginLeft: 12 }} />
            </div>
            <div className="mini">
              <button onClick={this.downloadCSV} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#4b49ac", color: "#fff", cursor: "pointer" }}>
                Download CSV
              </button>
            </div>
          </div>

          {msg && <div style={{ marginBottom: 10, color: "#b71c1c" }}>{msg}</div>}
          {loading && <div style={{ marginBottom: 10, color: "#666" }}>Loading…</div>}

          {parsedPreview && this.renderPreviewTable()}

          {showAdd && (
            <form onSubmit={this.handleAddSubmit} style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
              <input placeholder="Name" value={newName} onChange={(e) => this.setState({ newName: e.target.value })} style={input} />
              <input placeholder="Roll number" value={newRoll} onChange={(e) => this.setState({ newRoll: e.target.value })} style={input} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#2b7a78", color: "#fff" }}>Add</button>
                <button type="button" onClick={() => this.setState({ showAdd: false })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#fff" }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f3f4f6" }}>
                  <th style={{ padding: 10 }}>Name</th>
                  <th>Roll</th>
                  <th>Act1</th>
                  <th>Act2</th>
                  <th>Act3</th>
                  <th>Act4</th>
                  <th>Act5</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && !loading && (<tr><td colSpan={8} style={{ padding: 12, color: "#666" }}>No students yet</td></tr>)}

                {data.map((s) => {
                  const isEditing = editingId === s.id;
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #efefef" }}>
                      <td style={{ padding: 10, maxWidth: 250 }}>
                        {isEditing ? <input autoFocus style={input} value={editValues.name} onChange={this.changeEdit("name")} /> : s.name}
                      </td>

                      <td style={{ maxWidth: 140 }}>
                        {isEditing ? <input style={input} value={editValues.roll_number} onChange={this.changeEdit("roll_number")} /> : s.roll_number}
                      </td>

                      <td style={{ width: 110 }}>{isEditing ? <input style={input} value={editValues.activity1} onChange={this.changeEdit("activity1")} /> : s.activity1 ?? ""}</td>
                      <td style={{ width: 110 }}>{isEditing ? <input style={input} value={editValues.activity2} onChange={this.changeEdit("activity2")} /> : s.activity2 ?? ""}</td>
                      <td style={{ width: 110 }}>{isEditing ? <input style={input} value={editValues.activity3} onChange={this.changeEdit("activity3")} /> : s.activity3 ?? ""}</td>
                      <td style={{ width: 110 }}>{isEditing ? <input style={input} value={editValues.activity4} onChange={this.changeEdit("activity4")} /> : s.activity4 ?? ""}</td>
                      <td style={{ width: 110 }}>{isEditing ? <input style={input} value={editValues.activity5} onChange={this.changeEdit("activity5")} /> : s.activity5 ?? ""}</td>

                      <td>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => this.saveRow(s)} style={{ padding: "6px 8px", borderRadius: 6, border: "none", background: "#2b7a78", color: "#fff" }}>Save</button>
                            <button onClick={this.cancelEdit} style={{ padding: "6px 8px", borderRadius: 6 }}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => this.startEdit(s)} style={{ padding: "6px 8px", borderRadius: 6 }}>Edit</button>
                            <button onClick={() => this.deleteStudent(s.id)} style={{ padding: "6px 8px", borderRadius: 6, background: "#c43030", color: "#fff", border: "none" }}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
            <div style={smallMuted}>Notes:</div>
            <div style={{ marginTop: 6 }}>
              Upload an Excel (.xlsx/.xls) or CSV file with columns <strong>name</strong> and <strong>roll_number</strong>.
              If the file contains activity columns (activity1..activity5 or act1..act5 or A1..A5) they will be saved too.
            </div>
          </div>
        </div>
      </>
    );
  }
}
