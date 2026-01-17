const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Aquí pegaremos la URL RAW que copiaste en el paso anterior
const GITHUB_INVENTARIO_URL = "TU_URL_RAW_AQUI";

let catalogo = { productos: [], servicios: [] };

// Función para actualizar los datos desde GitHub
async function cargarInventario() {
    try {
        const res = await axios.get(GITHUB_INVENTARIO_URL);
        catalogo = res.data;
        console.log("✅ Inventario actualizado");
    } catch (e) { console.error("❌ Error cargando inventario"); }
}

cargarInventario(); // Carga inicial

// WEBHOOK PARA GITHUB (Actualización automática)
app.post('/webhook-github', (req, res) => {
    cargarInventario();
    res.send("Actualizado");
});

// WEBHOOK PARA WHATSAPP (Validación de Meta)
app.get('/webhook-whatsapp', (req, res) => {
    const token = process.env.VERIFY_TOKEN;
    if (req.query['hub.verify_token'] === token) {
        return res.send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

// WEBHOOK PARA WHATSAPP (Recepción de mensajes)
app.post('/webhook-whatsapp', async (req, res) => {
    try {
        const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (message) {
            const clienteTel = message.from;
            const texto = message.text.body.toLowerCase();

            // Buscar en productos
            const prod = catalogo.productos.find(p => texto.includes(p.nombre.toLowerCase()));
            
            if (prod) {
                const caption = `*${prod.nombre}*\n💰 Precio: ${prod.precio}\n📝 ${prod.desc}`;
                await enviarWhatsApp(clienteTel, caption, prod.imagen);
            } else if (texto.includes("servicio")) {
                const listaServ = catalogo.servicios.map(s => `• ${s.nombre} (${s.precio})`).join("\n");
                await enviarWhatsApp(clienteTel, "🛠 *Nuestros Servicios:*\n" + listaServ);
            } else {
                await enviarWhatsApp(clienteTel, "👋 ¡Hola! Escribe el nombre de un producto o la palabra *servicios*.");
            }
        }
        res.sendStatus(200);
    } catch (e) { res.sendStatus(200); }
});

async function enviarWhatsApp(to, text, image = null) {
    const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const data = image 
        ? { messaging_product: "whatsapp", to, type: "image", image: { link: image, caption: text } }
        : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
    
    await axios.post(url, data, {
        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
