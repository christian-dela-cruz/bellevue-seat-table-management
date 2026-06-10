const fs = require('fs');
const path = require('path');

const targetFile = 'c:/Users/Christian/seat-table-mngmnt/frontend/src/features/admin/pages/ReservationDashboard.jsx';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add pricingForm state
if (!content.includes('const [pricingForm, setPricingForm]')) {
  content = content.replace(
    '  const [editError,setEditError]=useState("");',
    `  const [editError,setEditError]=useState("");
  
  const [pricingForm, setPricingForm] = useState({
    pricing_mode: reservation.pricing_mode || "",
    base_price: reservation.base_price || "",
    price_per_person: reservation.price_per_person || "",
    price_per_seat: reservation.price_per_seat || "",
    package_name: reservation.package_name || "",
    package_price: reservation.package_price || "",
    manual_price_override: reservation.manual_price_override || "",
    price_notes: reservation.price_notes || "",
    show_price_to_guest: !!reservation.show_price_to_guest,
  });
  const [pricingLoading, setPricingLoading] = useState(false);
  const [isEditingPricing, setIsEditingPricing] = useState(false);`
  );
}

// 2. Add pricingForm update to useEffect
if (!content.includes('setPricingForm({')) {
  content = content.replace(
    '    });\n  }, [reservation]);',
    `    });
    setPricingForm({
      pricing_mode: reservation.pricing_mode || "",
      base_price: reservation.base_price || "",
      price_per_person: reservation.price_per_person || "",
      price_per_seat: reservation.price_per_seat || "",
      package_name: reservation.package_name || "",
      package_price: reservation.package_price || "",
      manual_price_override: reservation.manual_price_override || "",
      price_notes: reservation.price_notes || "",
      show_price_to_guest: !!reservation.show_price_to_guest,
    });
  }, [reservation]);`
  );
}

// 3. Add handlePricingSave function
if (!content.includes('const handlePricingSave')) {
  content = content.replace(
    '  const handleReviewSave=()=>{',
    `  const handlePricingSave = async () => {
    setPricingLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(\`\${API_BASE_URL}/admin/reservations/\${reservation.id}/pricing\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: \`Bearer \${token}\` }) },
        body: JSON.stringify(pricingForm)
      });
      const data = await res.json();
      if (data.success) {
        setIsEditingPricing(false);
      } else {
        alert(data.message || "Failed to save pricing");
      }
    } catch (e) {
      alert("Error saving pricing");
    } finally {
      setPricingLoading(false);
    }
  };

  const handleReviewSave=()=>{`
  );
}

fs.writeFileSync(targetFile, content);
console.log('Injected pricing state and functions');
