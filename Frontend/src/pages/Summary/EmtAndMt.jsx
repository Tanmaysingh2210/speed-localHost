import React from 'react';
import { useState, useEffect, useRef } from "react";
import "../transaction/transaction.css";
import api from "../../api/api";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import pepsiLogo from "../../assets/pepsi_logo.png";
import { useDepo } from '../../context/depoContext';
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext';

const EmtAndMtSummary = () => {
    const [period, setPeriod] = useState({ startDate: "", endDate: "" });
    const [summary, setSummary] = useState([]);
    const [grandTotal, setGrandTotal] = useState(null);
    const [loading, setLoading] = useState(false);
    const { depos } = useDepo();
    const { user } = useAuth();
    const { showToast } = useToast();
    const getDepo = (depo) => {
        if (!depo || !Array.isArray(depos)) return "";
        const id = String(depo).trim();
        const matchDepo = depos.find((d) => String(d._id).trim() === id);
        return matchDepo;
    }
    const getSummary = async (e) => {
        e.preventDefault();
        if (!period.startDate || !period.endDate || period.startDate > period.endDate) {
            showToast("Fill both date properly", 'error');
            return;
        }
        try {
            setLoading(true);
            const res = await api.post('/summary/emtandmt', period);
            if (res?.data?.success) {
                setSummary(res?.data?.data);
                setGrandTotal(res?.data?.grandTotal || null);
            }

            showToast("Emt and mt fetch successfully", "success");
        }
        catch (err) {
            showToast(err.response?.data?.message || "Error fetching summary", 'error');
        }
        finally {
            setLoading(false);
        }
    }

    const startRef = useRef(null);
    const endRef = useRef(null);
    const findRef = useRef(null);

    useEffect(() => {
        startRef.current?.focus();
    }, []);

    const handleKeyNav = (e, currentField) => {
        if (["ArrowRight", "ArrowDown", "Enter"].includes(e.key)) {
            e.preventDefault();
            if (e.key === "Enter" && currentField === "find") {
                findRef.current?.click();
                return;
            }
            switch (currentField) {
                case "startDate":
                    endRef.current?.focus();
                    break;
                case "endDate":
                    if (e.key === "Enter") {
                        findRef.current?.click();
                    } else {
                        findRef.current?.focus();
                    }
                    break;
                default:
                    break;
            }
        }
        else if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
            e.preventDefault();
            switch (currentField) {
                case "find":
                    endRef.current?.focus();
                    break;
                case "endDate":
                    startRef.current?.focus();
                    break;
                default:
                    break;
            }
        }
    }

    const loadImageBase64 = (url) =>
        new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function () {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext("2d").drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            };
            img.src = url;
        });


    const exportSummaryPDF = async () => {
        if (!summary.length) {
            showToast("No data to export", "error");
            return;
        }

        const doc = new jsPDF();

        const logoBase64 = await loadImageBase64(pepsiLogo);
        doc.addImage(logoBase64, "PNG", 12, 5, 35, 18);

        doc.setFontSize(14);
        doc.text("SAN BEVERAGES PVT LTD", 105, 15, { align: "center" });
        doc.setFontSize(8);
        doc.text(getDepo(user.depo)?.depoAddress || "", 105, 22, { align: "center" });

        doc.setFontSize(10);
        doc.text("EMT AND MT SUMMARY", 105, 29, { align: "center" });

        const tableData = summary.map((r, i) => [
            i + 1,
            r.salesmanCode,
            r.name,
            r.totalMt,
            r.totalEmt,
            `${r.shortExcess} (${r.shortExcessLabel})`
        ]);

        if (grandTotal) {
            tableData.push([
                "",
                "",
                "TOTAL",
                grandTotal.grandTotalMt,
                grandTotal.grandTotalEmt,
                `${grandTotal.grandTotalShortExcess} (${grandTotal.grandShortExcessLabel})`
            ]);
        }

        autoTable(doc, {
            startY: 35,
            head: [["SL", "SALESMAN CODE", "NAME", "MT", "EMT", "SHORT/EXCESS"]],
            body: tableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [0, 0, 0] },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            didParseCell: function (data) {
                if (data.row.index === tableData.length - 1) {
                    data.cell.styles.fontStyle = "bold";
                }
                // Color the short/excess column
                if (data.column.index === 5 && data.section === 'body') {
                    const cellText = String(data.cell.raw || '');
                    if (cellText.includes('Short')) {
                        data.cell.styles.textColor = [220, 38, 38];
                    } else if (cellText.includes('Excess')) {
                        data.cell.styles.textColor = [22, 163, 74];
                    }
                }
            }
        });

        const blob = doc.output("bloburl");
        const w = window.open(blob);
        w.onload = () => w.print();
    };

    const exportSummaryExcel = async () => {
        if (!summary.length) {
            showToast("No data to export", "error");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Summary");

        const logoBase64 = await loadImageBase64(pepsiLogo);

        const imageId = workbook.addImage({
            base64: logoBase64,
            extension: "png"
        });

        sheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 120, height: 70 }
        });

        sheet.mergeCells("C2:J2");
        sheet.mergeCells("C3:J3");
        sheet.mergeCells("C5:J5");

        sheet.getCell("C2").value = "SAN BEVERAGES PVT LTD";
        sheet.getCell("C3").value = getDepo(user.depo)?.depoAddress || "";
        sheet.getCell("C5").value = "EMT AND MT SUMMARY REPORT";

        sheet.getCell("C2").alignment = { horizontal: "center" };
        sheet.getCell("C3").alignment = { horizontal: "center" };
        sheet.getCell("C5").alignment = { horizontal: "center" };

        sheet.getCell("B2").font = { bold: true, size: 14 };
        sheet.getCell("B3").font = { size: 11 };
        sheet.getCell("B5").font = { bold: true };

        sheet.getRow(7).values = [
            "SL", "SALESMAN CODE", "NAME", "MT", "EMT", "SHORT/EXCESS"
        ];

        sheet.getRow(7).font = { bold: true };

        summary.forEach((r, i) => {
            const row = sheet.addRow([
                i + 1,
                r.salesmanCode,
                r.name,
                r.totalMt,
                r.totalEmt,
                `${r.shortExcess} (${r.shortExcessLabel})`
            ]);

            // Color the short/excess cell
            const seCell = row.getCell(6);
            seCell.font = {
                color: { argb: r.shortExcessLabel === 'Short' ? 'FFDC2626' : 'FF16A34A' }
            };
        });

        if (grandTotal) {
            const totalRow = sheet.addRow([
                "",
                "",
                "TOTAL",
                grandTotal.grandTotalMt,
                grandTotal.grandTotalEmt,
                `${grandTotal.grandTotalShortExcess} (${grandTotal.grandShortExcessLabel})`
            ]);
            totalRow.font = { bold: true };
            const seCell = totalRow.getCell(6);
            seCell.font = {
                bold: true,
                color: { argb: grandTotal.grandShortExcessLabel === 'Short' ? 'FFDC2626' : 'FF16A34A' }
            };
        }

        sheet.columns = [
            { width: 6 },
            { width: 20 },
            { width: 30 },
            { width: 12 },
            { width: 12 },
            { width: 18 }
        ];

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), "EmtAndMtSummary.xlsx");
    };

    return (
        <div className='trans'>
            <div className="trans-container">
                <div className="trans-up">
                    <div className="flex">
                        <div className="form-group">
                            <label>Start-date</label>
                            <input
                                ref={startRef}
                                value={period.startDate}
                                type="date"
                                onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
                                onKeyDown={(e) => handleKeyNav(e, "startDate")}
                            />
                        </div>
                        <div className="form-group">
                            <label>End-date</label>
                            <input
                                ref={endRef}
                                type="date"
                                value={period.endDate}
                                onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
                                onKeyDown={(e) => handleKeyNav(e, "endDate")}
                            />
                        </div>
                        <div className="form-group pdf">
                            <button
                                className="padd trans-submit-btn"
                                disabled={loading}
                                ref={findRef}
                                onKeyDown={(e) => handleKeyNav(e, "find")}
                                onClick={getSummary}
                            >
                                {loading ? "Wait..." : "Find"}
                            </button>
                            <button className="export-btn pdf padd trans-submit-btn" onClick={exportSummaryPDF}>
                                🖨️ Print
                            </button>
                            <button className="export-btn excel pdf padd trans-submit-btn" onClick={exportSummaryExcel}>
                                📊 Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="trans-container set-margin">
                <div className="all-table">
                    <div className="all-row3 header">
                        <div>CODE</div>
                        <div>SALESMAN NAME</div>
                        <div>MT</div>
                        <div>EMT</div>
                        <div>SHORT/EXCESS</div>
                    </div>
                    {loading && (
                        <div style={{ textAlign: "center", padding: "20px" }}>
                            Fetching summary...
                        </div>
                    )}

                    {summary.length === 0 && !loading && (
                        <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: '#666',
                            backgroundColor: 'white'
                        }}>
                            No items found
                        </div>
                    )}

                    {summary.map((p, i) => {
                        const isShort = p.shortExcessLabel === 'Short';
                        return (
                            <div key={i} className="all-row3">
                                <div>{p.salesmanCode}</div>
                                <div>{p.name}</div>
                                <div>{p.totalMt}</div>
                                <div>{p.totalEmt}</div>
                                <div style={{
                                    color: isShort ? "#dc2626" : "#16a34a",
                                    fontWeight: "600"
                                }}>
                                    {p.shortExcess}
                                </div>
                            </div>
                        )
                    })}

                    {summary.length > 0 && grandTotal && (
                        <div className="all-row3 total-row">
                            <div></div>
                            <div><strong>TOTAL</strong></div>
                            <div style={{ textAlign: "center" }}><strong>{grandTotal.grandTotalMt}</strong></div>
                            <div style={{ textAlign: "center" }}><strong>{grandTotal.grandTotalEmt}</strong></div>
                            <div style={{
                                color: grandTotal.grandShortExcessLabel === 'Short' ? "#dc2626" : "#16a34a",
                                fontWeight: "700",
                                textAlign: "right"
                            }}>
                                <strong>{grandTotal.grandTotalShortExcess}</strong>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
export default EmtAndMtSummary;