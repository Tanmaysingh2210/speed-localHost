import api from "../../api/api.js";
import { useState, useEffect, useRef } from 'react';
import "../transaction/transaction.css";
import { useDepo } from '../../context/depoContext';
import { useAuth } from '../../context/AuthContext'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import pepsiLogo from "../../assets/pepsi_logo.png";
import { useToast } from "../../context/ToastContext.jsx";

const ShortExcess = () => {
    const { showToast } = useToast();
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [grandTotals, setGrandTotals] = useState({
        gtCases: 0,
        gtBottles: 0,
        gtAmount: 0,
        gtDeposit: 0,
        gtShortExcess: 0
    });
    const { depos } = useDepo();
    const { user } = useAuth();
    const startRef = useRef(null);
    const endRef = useRef(null);
    const findRef = useRef(null);

    const getDepo = (depo) => {
        if (!depo || !Array.isArray(depos)) return "";
        const id = String(depo).trim();
        const matchDepo = depos.find((d) => String(d._id).trim() === id);
        return matchDepo;
    }
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


    const handleFind = async () => {
        if (!startDate || !endDate) {
            showToast("Please fill all fields", "error");
            return;
        }

        try {
            setLoading(true);
            const payload = {
                startDate,
                endDate
            };

            const res = await api.post(`/summary/short-excess-summary`, payload);

            setRows(res.data.data || []);

            setGrandTotals(
                res.data.grandTotals || {
                    gtCases: 0,
                    gtBottles: 0,
                    gtAmount: 0,
                    gtDeposit: 0,
                    gtShortExcess: 0
                }
            );

        } catch (err) {
            console.error(err);
            showToast("Error fetching summary", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadImageBase64 = (url) =>
        new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function () {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            };
            img.src = url;
        });


    const exportSummaryPDF = async () => {
        if (!rows.length) {
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
        doc.text("SHORT/EXCESS SUMMARY REPORT", 105, 29, { align: "center" });

        const tableData = rows.map((r, i) => [
            i + 1,
            r.salesmanCode,
            r.name,
            r.cases,
            r.bottles,
            Number(r.amount).toFixed(2),
            Number(r.deposit).toFixed(2),
            r.shortExcess
        ]);
        tableData.push([
            "",
            "",
            "TOTAL",
            grandTotals.gtCases,
            grandTotals.gtBottles,
            Number(grandTotals.gtAmount).toFixed(2),
            Number(grandTotals.gtDeposit).toFixed(2),
            Number(grandTotals.gtShortExcess).toFixed(2)
        ]);
        autoTable(doc, {
            startY: 35,
            head: [[
                "SL",
                "SALESMAN CODE",
                "NAME",
                "CS",
                "BS",
                "AMOUNT",
                "DEPOSIT",
                "SHORT/EXCESS"
            ]],
            body: tableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [0, 0, 0] },
            alternateRowStyles: { fillColor: [245, 245, 245] },

            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 28 },
                2: { cellWidth: 45 },
                3: { cellWidth: 14 },
                4: { cellWidth: 14 },
                5: { cellWidth: 25 },
                6: { cellWidth: 25 },
                7: { cellWidth: 28 }
            },

            didParseCell(data) {
                if (data.row.index === tableData.length - 1) {
                    data.cell.styles.fontStyle = "bold";
                }
            }
        });

        const blob = doc.output("bloburl");
        const w = window.open(blob);
        w.onload = () => w.print();
    };

    const exportSummaryExcel = async () => {
        if (!rows.length) {
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

        sheet.mergeCells("C2:H2");
        sheet.mergeCells("C3:H3");
        sheet.mergeCells("C5:H5");

        sheet.getCell("C2").value = "SAN BEVERAGES PVT LTD";
        sheet.getCell("C3").value = getDepo(user.depo)?.depoAddress || "";
        sheet.getCell("C5").value = "SHORT/EXCESS SUMMARY REPORT";

        sheet.getCell("C2").alignment = { horizontal: "center" };
        sheet.getCell("C3").alignment = { horizontal: "center" };
        sheet.getCell("C5").alignment = { horizontal: "center" };


        sheet.getCell("B2").font = { bold: true, size: 14 };
        sheet.getCell("B3").font = { size: 11 };
        sheet.getCell("B5").font = { bold: true };

        sheet.getRow(7).values = [
            "SL", "SALESMAN CODE", "NAME", "CS", "BS", "NET SALE AMT", "TOTAL DEPOSIT", "SHORT/EXCESS"
        ];

        sheet.getRow(7).font = { bold: true };

        rows.forEach((r, i) => {
            sheet.addRow([
                i + 1,
                r.salesmanCode,
                r.name,
                r.cases,
                r.bottles,
                Number(r.amount).toFixed(2),
                Number(r.deposit).toFixed(2),
                r.shortExcess?.toFixed(2)
            ]);
        });

        const totalRow = sheet.addRow([
            "",
            "",
            "TOTAL",
            grandTotals.gtCases,
            grandTotals.gtBottles,
            Number(grandTotals.gtAmount).toFixed(2),
            Number(grandTotals.gtDeposit).toFixed(2),
            Number(grandTotals.gtShortExcess).toFixed(2)
        ]);

        totalRow.font = { bold: true };

        sheet.columns = [
            { width: 6 },
            { width: 18 },
            { width: 30 },
            { width: 10 },
            { width: 10 },
            { width: 16 },
            { width: 16 },
            { width: 18 }
        ];

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), "short/excess-summary.xlsx");
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
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, "startDate")}
                            />

                        </div>
                        <div className="form-group">
                            <label>End-date</label>
                            <input
                                ref={endRef}
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                onKeyDown={(e) => handleKeyNav(e, "endDate")}
                            />
                        </div>



                        <div className="form-group pdf">
                            <button onClick={handleFind}
                                ref={findRef}
                                onKeyDown={(e) => handleKeyNav(e, "find")}
                                className="padd trans-submit-btn"
                            >
                                {loading ? "Loading..." : "Find"}
                            </button>

                            <button className="export-btn pdf padd trans-submit-btn" onClick={exportSummaryPDF}>
                                🖨️ Print
                            </button>


                            <button className="export-btn excel padd trans-submit-btn" onClick={exportSummaryExcel}>
                                📊 Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="trans-container set-margin">
                <div className="all-table">
                    <div className="all-row7 header">
                        <div>SalesmanCode</div>
                        <div>Name</div>
                        <div>CS</div>
                        <div>BS</div>
                        <div>Net Sale Amt</div>
                        <div>Total Deposit</div>
                        <div>Short/Excess</div>
                    </div>

                    {rows.length === 0 && (
                        <div style={{ padding: "20px", textAlign: "center" }}>
                            No data found
                        </div>
                    )}

                    {rows.map((r, i) => (
                        <div className="all-row7" key={i}>
                            <div>{r.salesmanCode}</div>
                            <div>{r.name}</div>
                            <div>{r.cases}</div>
                            <div>{r.bottles}</div>
                            <div>₹{Number(r.amount).toFixed(2)}</div>
                            <div>₹{Number(r.deposit).toFixed(2)}</div>
                            <div>{(r.shortExcess >= 0) &&
                                (<div style={{
                                    color: "green"
                                }}> ₹{r.shortExcess.toFixed(2)}</div>)}

                                {(r.shortExcess < 0) &&
                                    (
                                        <div style={{
                                            color: "red"
                                        }}> ₹{r.shortExcess.toFixed(2)}</div>)}
                            </div>
                        </div>
                    ))}
                    {(rows.length > 0) &&
                        <div className="all-row7 total-row">
                            <div></div>
                            <div><strong>Total</strong></div>
                            <div style={{ color: grandTotals.gtCases >= 0 ? "green" : "red" }}>
                                {grandTotals.gtCases}
                            </div>
                            <div style={{ color: grandTotals.gtBottles >= 0 ? "green" : "red" }}>
                                {grandTotals.gtBottles}
                            </div>
                            <div>
                                ₹{Number(grandTotals.gtAmount).toFixed(2)}
                            </div>
                            <div>
                                ₹{Number(grandTotals.gtDeposit).toFixed(2)}
                            </div>
                            <div
                                style={{
                                    color:
                                        grandTotals.gtShortExcess >= 0
                                            ? "green"
                                            : "red"
                                }}
                            >
                                ₹{Number(grandTotals.gtShortExcess).toFixed(2)}
                            </div>
                        </div>
                    }
                </div>

            </div>

        </div>
    )
}

export default ShortExcess