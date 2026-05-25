import React, { useState, useRef, useEffect } from "react";
import "./Prices.css";
import { usePrice } from "../../context/PricesContext";
import { useSKU } from "../../context/SKUContext";
import { useToast } from "../../context/ToastContext";
import { useItemModal } from "../../context/ItemModalContext";

const MtPrice = () => {
    const { showToast } = useToast();
    const { mtPrices, addMtPrice, updateMtPrice, deleteMtPrice, loading } = usePrice();
    const { items } = useSKU();
    const { openItemModal } = useItemModal();

    const [activeTab, setActiveTab] = useState("latest"); // "latest" | "browse"
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [search, setSearch] = useState("");
    const [selectedDate, setSelectedDate] = useState("");

    const [form, setForm] = useState({
        code: "",
        cratePrice: "",
        emptyBottlePrice: "",
        drinkPrice: "",
        perTax: "",
        perDisc: "",
        date: "",
        status: "Active"
    });

    const modalRef   = useRef(null);
    const codeRef    = useRef(null);
    const crateRef   = useRef(null);
    const bottleRef  = useRef(null);
    const drinkRef   = useRef(null);
    const discRef    = useRef(null);
    const taxRef     = useRef(null);
    const dateRef    = useRef(null);
    const statusRef  = useRef(null);
    const saveRef    = useRef(null);

    // Focus first field on modal open
    useEffect(() => {
        if (showModal) setTimeout(() => codeRef.current?.focus(), 100);
    }, [showModal]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) setShowModal(false);
        };
        if (showModal) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showModal]);

    const handleKeyNav = (e, field) => {
        const order = ["code", "crate", "bottle", "drink", "disc", "tax", "date", "status", "save"];
        const fwd = ["ArrowRight", "ArrowDown", "Enter"];
        const bwd = ["ArrowUp", "ArrowLeft"];
        const refs = { code: codeRef, crate: crateRef, bottle: bottleRef, drink: drinkRef, disc: discRef, tax: taxRef, date: dateRef, status: statusRef, save: saveRef };

        if (fwd.includes(e.key)) {
            e.preventDefault();
            if (e.key === "Enter" && field === "save") { saveRef.current?.click(); return; }
            if (e.key === "Enter" && field === "date") { saveRef.current?.click(); return; }
            const idx = order.indexOf(field);
            if (idx < order.length - 1) refs[order[idx + 1]]?.current?.focus();
        } else if (bwd.includes(e.key)) {
            e.preventDefault();
            const idx = order.indexOf(field);
            if (idx > 0) refs[order[idx - 1]]?.current?.focus();
        }
    };

    const resetForm = () => setForm({ code: "", cratePrice: "", emptyBottlePrice: "", drinkPrice: "", perTax: "", perDisc: "", date: "", status: "Active" });

    const openAdd = () => {
        setEditId(null);
        resetForm();
        setShowModal(true);
    };

    const openEdit = (p) => {
        setEditId(p._id);
        setForm({
            code: p.itemCode || "",
            cratePrice: p.cratePrice || "",
            emptyBottlePrice: p.emptyBottlePrice || "",
            drinkPrice: p.drinkPrice || "",
            perTax: p.perTax || "",
            perDisc: p.perDisc || "",
            date: p.date ? p.date.split("T")[0] : "",
            status: p.status || "Active"
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.code || !form.cratePrice || !form.emptyBottlePrice || !form.drinkPrice || !form.date) {
            showToast("Fill all required fields", "error");
            return;
        }
        const payload = {
            itemCode: form.code.trim().toUpperCase(),
            cratePrice: Number(form.cratePrice),
            emptyBottlePrice: Number(form.emptyBottlePrice),
            drinkPrice: Number(form.drinkPrice),
            perTax: Number(form.perTax) || 0,
            perDisc: Number(form.perDisc) || 0,
            date: form.date,
            status: form.status
        };
        try {
            if (editId) {
                await updateMtPrice(editId, payload);
            } else {
                await addMtPrice(payload);
            }
            setShowModal(false);
            resetForm();
            setEditId(null);
        } catch (err) {
            // toast shown in context
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this MT price?")) await deleteMtPrice(id);
    };

    const FormatDate = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
    };

    const matchedItem = Array.isArray(items)
        ? items.find(it => String(it.code || "").toUpperCase() === String(form.code || "").toUpperCase())
        : null;

    // ── Net Price Calculator ──
    const calcNetPrice = (cratePrice, emptyBottlePrice, drinkPrice, perDisc, perTax, packOf) => {
        const cp = Number(cratePrice) || 0;
        const bp = Number(emptyBottlePrice) || 0;
        const dp = Number(drinkPrice) || 0;
        const disc = Number(perDisc) || 0;
        const tax = Number(perTax) || 0;
        const po = Number(packOf) || 0;
        const discounted = dp - (dp * disc / 100);
        return cp + (bp * po) + discounted + (discounted * tax / 100);
    };

    const formNetPrice = calcNetPrice(
        form.cratePrice, form.emptyBottlePrice, form.drinkPrice,
        form.perDisc, form.perTax, matchedItem?.packOf
    );

    // ── Filter logic ──
    const safeStr = v => (v == null ? "" : String(v));

    // Latest tab: only Active, one per item (most recent)
    const getLatest = () => {
        const map = {};
        for (const p of (mtPrices || [])) {
            const code = p.itemCode;
            if (!map[code] || new Date(p.date) > new Date(map[code].date)) {
                map[code] = p;
            }
        }
        return Object.values(map).filter(p => p.status === "Active");
    };

    // Browse tab: all, optionally filtered by date (latest on or before selectedDate per item)
    const getBrowse = () => {
        if (!selectedDate) return mtPrices || [];
        const map = {};
        for (const p of (mtPrices || [])) {
            const pd = p.date?.split("T")[0];
            if (pd <= selectedDate) {
                const code = p.itemCode;
                if (!map[code] || pd > map[code].date?.split("T")[0]) map[code] = p;
            }
        }
        return Object.values(map);
    };

    const baseList = activeTab === "latest" ? getLatest() : getBrowse();
    const filtered = baseList.filter(p =>
        safeStr(p?.itemCode).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="price-container">
            {/* ── Header ── */}
            <div className="price-header">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <input
                        type="text"
                        placeholder="🔍 Search Item Code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="price-search"
                    />
                    <div style={{ display: "flex", gap: "0", borderBottom: "2px solid #e5e7eb" }}>
                        {["latest", "browse"].map(tab => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setSearch(""); setSelectedDate(""); }}
                                style={{
                                    padding: "10px 24px",
                                    border: "none",
                                    borderBottom: activeTab === tab ? "2px solid #10b981" : "2px solid transparent",
                                    background: "none",
                                    cursor: "pointer",
                                    fontWeight: activeTab === tab ? "600" : "400",
                                    color: activeTab === tab ? "#10b981" : "#6b7280",
                                    fontSize: "14px",
                                    marginBottom: "-2px",
                                    textTransform: "capitalize",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {tab === "latest" ? "Latest Price" : "Browse Price"}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {activeTab === "browse" && (
                        <>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                            />
                            <button
                                onClick={() => setSelectedDate("")}
                                style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500" }}
                            >
                                Clear
                            </button>
                        </>
                    )}
                    <button className="price-add-btn" disabled={loading} onClick={openAdd}>
                        + New MT Price
                    </button>
                </div>
            </div>

            {activeTab === "browse" && selectedDate && (
                <p style={{ marginBottom: "15px", color: "#666" }}>
                    Showing MT prices active on: <strong>{FormatDate(selectedDate + "T00:00:00")}</strong>
                </p>
            )}

            {loading && <div className="loading">Loading...</div>}

            {/* ── Table ── */}
            <div className="price-table">
                <div className="price-row" style={{ gridTemplateColumns: "50px 90px 1fr 110px 110px 110px 70px 70px 120px 110px 80px 120px" }}>
                    <div>SL.</div>
                    <div>CODE</div>
                    <div>NAME</div>
                    <div>CRATE PRICE</div>
                    <div>BOTTLE PRICE</div>
                    <div>DRINK PRICE</div>
                    <div>% DISC</div>
                    <div>% TAX</div>
                    <div>NET PRICE</div>
                    <div>DATE</div>
                    <div>STATUS</div>
                    <div>ACTIONS</div>
                </div>

                {filtered.length === 0 && !loading && (
                    <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>No MT prices found</div>
                )}

                {filtered.map((p, i) => {
                    const rowItem = Array.isArray(items)
                        ? items.find(it => String(it.code || "").toUpperCase() === String(p.itemCode || "").toUpperCase())
                        : null;
                    const rowNetPrice = calcNetPrice(
                        p.cratePrice, p.emptyBottlePrice, p.drinkPrice,
                        p.perDisc, p.perTax, rowItem?.packOf
                    );
                    return (
                        <div key={p._id || i} className="price-row" style={{ gridTemplateColumns: "50px 90px 1fr 110px 110px 110px 70px 70px 120px 110px 80px 120px" }}>
                            <div>{i + 1}</div>
                            <div>{p.itemCode?.toUpperCase() || ""}</div>
                            <div>{rowItem?.name?.toUpperCase() || ""}</div>
                            <div>₹{p.cratePrice || 0}</div>
                            <div>₹{p.emptyBottlePrice || 0}</div>
                            <div>₹{p.drinkPrice || 0}</div>
                            <div>{p.perDisc || 0}%</div>
                            <div>{p.perTax || 0}%</div>
                            <div style={{ fontWeight: "600", color: "#10b981" }}>₹{rowNetPrice.toFixed(2)}</div>
                            <div>{FormatDate(p.date)}</div>
                            <div className="status">
                                <span className={`status-badge ${p.status === "Active" ? "active" : "inactive"}`}>
                                    {p.status}
                                </span>
                            </div>
                            <div className="actions">
                                <span className="edit" onClick={() => openEdit(p)}>Edit</span>
                                {" | "}
                                <span className="delete" onClick={() => handleDelete(p._id)}>Delete</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal ── */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" ref={modalRef}>
                        <h2>{editId ? "Edit MT Price" : "Add New MT Price"}</h2>
                        <form onSubmit={handleSave}>

                            <div className="form-group">
                                <label>Item Code</label>
                                <div className="input-with-btn">
                                    <input
                                        ref={codeRef}
                                        type="text"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value.trim().toUpperCase() })}
                                        onKeyDown={(e) => handleKeyNav(e, "code")}
                                        disabled={!!editId}
                                        placeholder="Enter item code"
                                    />
                                    {!editId && (
                                        <button
                                            type="button"
                                            className="dropdown-btn"
                                            onClick={() => openItemModal(
                                            (code) => setForm(prev => ({ ...prev, code: code.trim().toUpperCase() })),
                                            (item) => {
                                                const c = (item.container || "").toLowerCase();
                                                return c === "mt" || c === "emt";
                                            }
                                        )}
                                        >
                                            ⌄
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Item Name</label>
                                <input type="text" value={matchedItem?.name || ""} readOnly style={{ backgroundColor: "#f5f5f5" }} />
                            </div>

                            <div className="form-group">
                                <label>Crate Price (₹)</label>
                                <input
                                    ref={crateRef}
                                    type="number"
                                    value={form.cratePrice}
                                    onChange={(e) => setForm({ ...form, cratePrice: e.target.value })}
                                    onKeyDown={(e) => handleKeyNav(e, "crate")}
                                    placeholder="Price per crate"
                                />
                            </div>

                            <div className="form-group">
                                <label>Empty Bottle Price (₹)</label>
                                <input
                                    ref={bottleRef}
                                    type="number"
                                    value={form.emptyBottlePrice}
                                    onChange={(e) => setForm({ ...form, emptyBottlePrice: e.target.value })}
                                    onKeyDown={(e) => handleKeyNav(e, "bottle")}
                                    placeholder="Price per empty bottle"
                                />
                            </div>

                            <div className="form-group">
                                <label>Drink Price (₹)</label>
                                <input
                                    ref={drinkRef}
                                    type="number"
                                    value={form.drinkPrice}
                                    onChange={(e) => setForm({ ...form, drinkPrice: e.target.value })}
                                    onKeyDown={(e) => handleKeyNav(e, "drink")}
                                    placeholder="Price of drink"
                                />
                            </div>

                            <div className="form-group">
                                <label>% Disc</label>
                                <input
                                    ref={discRef}
                                    type="number"
                                    value={form.perDisc}
                                    onChange={(e) => setForm({ ...form, perDisc: e.target.value })}
                                    onKeyDown={(e) => handleKeyNav(e, "disc")}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label>% Tax</label>
                                <input
                                    ref={taxRef}
                                    type="number"
                                    value={form.perTax}
                                    onChange={(e) => setForm({ ...form, perTax: e.target.value })}
                                    onKeyDown={(e) => handleKeyNav(e, "tax")}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    ref={dateRef}
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                    onKeyDown={(e) => handleKeyNav(e, "date")}
                                />
                            </div>

                            <div className="form-group">
                                <label>Net Price (₹)</label>
                                <input
                                    type="text"
                                    value={formNetPrice ? `₹${formNetPrice.toFixed(2)}` : "₹0.00"}
                                    readOnly
                                    style={{ backgroundColor: "#f0fdf4", fontWeight: "600", color: "#10b981", border: "1px solid #bbf7d0" }}
                                />
                            </div>

                            {editId && (
                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        ref={statusRef}
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        onKeyDown={(e) => handleKeyNav(e, "status")}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            )}

                            <div className="modal-buttons">
                                <button
                                    ref={saveRef}
                                    type="submit"
                                    className="submit-btn"
                                    onKeyDown={(e) => handleKeyNav(e, "save")}
                                    disabled={loading}
                                >
                                    {loading ? "Saving..." : editId ? "Update" : "Save"}
                                </button>
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => { setShowModal(false); resetForm(); setEditId(null); }}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MtPrice;