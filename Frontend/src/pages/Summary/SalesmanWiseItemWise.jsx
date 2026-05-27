import api from "../../api/api.js";
import { useState, useEffect, useRef } from 'react';
import { useSalesmanModal } from '../../context/SalesmanModalContext.jsx';
import "../transaction/transaction.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import pepsiLogo from "../../assets/pepsi_logo.png";
import { useDepo } from '../../context/depoContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from "../../context/ToastContext.jsx";

const SalesmanWiseItemWise = () => {
  const { showToast } = useToast();
  const [salesmanCode, setSalesmanCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { openSalesmanModal } = useSalesmanModal();

  const startRef = useRef(null);
  const endRef = useRef(null);
  const findRef = useRef(null);
  const saleCodeRef = useRef(null);
  const { depos } = useDepo();
  const { user } = useAuth();
  const [grandTotal, setGrandTotal] = useState({
    grandTotalCases: 0,
    grandTotalBottles: 0,
    amount: 0
  });
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
        case "saleCode":
          startRef.current?.focus();
          break;
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
        case "startDate":
          saleCodeRef.current?.focus();
          break;
        default:
          break;
      }
    }
  }

  const handleFind = async () => {
    if (!salesmanCode || !startDate || !endDate) {
      showToast("Please fill all fields", "error");
      return;
    }

    try {
      setLoading(true);


      const res = await api.post(`/summary/salesman-wise-item-wise`, { salesmanCode, startDate, endDate });
      setRows(res.data.data || []);

      setGrandTotal(
        res.data.grandTotal || {
          grandTotalCases: 0,
          grandTotalBottles: 0,
          amount: 0
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
        canvas.getContext("2d").drawImage(img, 0, 0);
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
    doc.text("SALESMAN WISE ITEM WISE SUMMARY", 105, 29, { align: "center" });

    const tableData = rows.map((r, i) => [
      i + 1,
      r.itemCode,
      r.name,
      r.cases,
      r.bottles,
      Number(r.amount).toFixed(2)
    ]);

    tableData.push([
      "",
      "",
      "TOTAL",
      grandTotal.grandTotalCases,
      grandTotal.grandTotalBottles,
      Number(grandTotal.amount).toFixed(2)
    ]);


    autoTable(doc, {
      startY: 35,
      head: [["SL", "ITEM CODE", "ITEM NAME", "CS", "BS", "AMOUNT"]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: function (data) {
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

    sheet.mergeCells("C2:F2");
    sheet.mergeCells("C3:F3");
    sheet.mergeCells("C5:F5");

    sheet.getCell("C2").value = "SAN BEVERAGES PVT LTD";
    sheet.getCell("C3").value = getDepo(user.depo)?.depoAddress || "";
    sheet.getCell("C5").value = "SALESMAN WISE ITEM WISE SUMMARY";

    sheet.getCell("C2").alignment = { horizontal: "center" };
    sheet.getCell("C3").alignment = { horizontal: "center" };
    sheet.getCell("C5").alignment = { horizontal: "center" };


    sheet.getCell("B2").font = { bold: true, size: 14 };
    sheet.getCell("B3").font = { size: 11 };
    sheet.getCell("B5").font = { bold: true };

    sheet.getRow(7).values = [
      "SL",
      "ITEM CODE",
      "ITEM NAME",
      "CS",
      "BS",
      "Amount"
    ];

    sheet.getRow(7).font = { bold: true };

    rows.forEach((r, i) => {
      sheet.addRow([
        i + 1,
        r.itemCode,
        r.name,
        r.cases,
        r.bottles,
        Number(r.amount).toFixed(2)
      ]);
    });

    const totalRow = sheet.addRow([
      "",
      "",
      "TOTAL",
      grandTotal.grandTotalCases,
      grandTotal.grandTotalBottles,
      Number(grandTotal.amount).toFixed(2)
    ]);

    totalRow.font = { bold: true };

    sheet.columns = [
      { width: 6 },
      { width: 16 },
      { width: 34 },
      { width: 10 },
      { width: 10 },
      { width: 16 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "salesman-wise-summary.xlsx");
  };


  return (
    <div className='trans'>
      <div className="trans-container">
        <div className="trans-up">
          <div className="flex">
            <div className="form-group">
              <label>Salesman Code</label>
              <div className="input-with-btn">
                <input
                  onKeyDown={(e) => handleKeyNav(e, "saleCode")}
                  ref={saleCodeRef}
                  type="text"
                  value={salesmanCode}
                  onChange={(e) => setSalesmanCode(e.target.value)}
                />
                <button
                  type="button"
                  className="dropdown-btn"
                  onClick={() =>
                    openSalesmanModal((code) =>
                      setSalesmanCode(code)
                    )
                  }
                >
                  ⌄
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Start-date</label>
              <input
                onKeyDown={(e) => handleKeyNav(e, "startDate")}
                ref={startRef}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

            </div>
            <div className="form-group">
              <label>End-date</label>
              <input
                onKeyDown={(e) => handleKeyNav(e, "endDate")}
                ref={endRef}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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

              <button className="export-btn excel pdf padd trans-submit-btn" onClick={exportSummaryExcel}>
                📊 Excel
              </button>

            </div>
          </div>
        </div>
      </div>
      <div className="trans-container set-margin">
        <div className="all-table">
          <div className="all-row4 header">
            <div>ItemCode</div>
            <div>ItemName</div>
            <div>CS</div>
            <div>BS</div>
            <div>Amount</div>
          </div>

          {rows.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center" }}>
              No data found
            </div>
          )}

          {rows.map((r, i) => (
            <div className="all-row4" key={i}>
              <div>{r.itemCode}</div>
              <div>{r.name}</div>
              <div style={{ color: r.cases >= 0 ? "green" : "red" }}>
                {r.cases}
              </div>

              <div style={{ color: r.bottles >= 0 ? "green" : "red" }}>
                {r.bottles}
              </div>

              <div style={{ color: r.amount >= 0 ? "green" : "red" }}>
                ₹{parseFloat(r.amount || 0).toFixed(2)}
              </div>
            </div>

          ))}

          {rows.length > 0 &&
            <div className="all-row4 total-row">
              <div></div>
              <div><strong>Total</strong></div>
              <div style={{ color: Number(grandTotal.grandTotalCases) >= 0 ? "green" : "red" }}>
                {grandTotal.grandTotalCases}
              </div>

              <div style={{ color: Number(grandTotal.grandTotalBottles) >= 0 ? "green" : "red" }}>
                {grandTotal.grandTotalBottles}
              </div>

              <div style={{ color: Number(grandTotal.amount) >= 0 >= 0 ? "green" : "red" }}>
                ₹{Number(grandTotal.amount).toFixed(2)}
              </div>
            </div>
          }

        </div>
      </div>

    </div>
  )
}

export default SalesmanWiseItemWise