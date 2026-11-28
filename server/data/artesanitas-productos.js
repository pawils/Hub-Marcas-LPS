// server/data/artesanitas-productos.js
// Fuente única de datos de productos de Artesanitas Perú, usada para generar
// las páginas individuales de producto (/artesanitas-peru/producto/:slug)
// que se comparten en redes sociales con su propia vista previa (foto + nombre).
//
// El catálogo visual en public/artesanitas-peru.html sigue siendo estático
// (no se toca su render); esta lista solo alimenta las páginas de producto.

const WHATSAPP_NUMERO = '51929938466';

const productos = [
    {
        slug: 'taza-snoopy',
        nombre: 'Taza Snoopy',
        precio: 55,
        descripcion: 'Taza temática artesanal inspirada en Snoopy, modelada y esmaltada con cariño.',
        detalles: [
            '✨ Cerámica artesanal modelada a mano',
            '🎨 Pintada y esmaltada con esmaltes seguros para consumo',
            '☕ Edición temática especial Snoopy'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/taza_snoopy_0.jpeg'
        ]
    },

    {
        slug: 'taza-navidad-papa-noel',
        nombre: 'Taza Navideña Papá Noel',
        precio: 59.90,
        descripcion: 'Hermosa taza de cerámica artesanal con la figura de Papá Noel modelada y pintada a mano. Edición limitada de la Colección Navidad 2026, ideal para café, chocolate caliente o para regalar en estas fiestas.',
        detalles: [
            '🎄 Colección Navidad 2026',
            '✨ Cerámica artesanal modelada y pintada a mano',
            '☕ Apta para bebidas calientes',
            '📅 Preventa con entrega estimada: 10 de Diciembre'
        ],
        imagenes: [
            '/imagenes/Artesanitas/reservas_navidad_2026/Taza_navidad_papa_noel_1.jpeg'
        ]
    },
    {
        slug: 'taza-muneco-de-nieve',
        nombre: 'Taza Muñeco de Nieve',
        precio: 59.90,
        descripcion: 'Taza temática de Muñeco de Nieve modelada y pintada a mano en cerámica fina. Edición festiva de la Colección Navidad 2026.',
        detalles: [
            '⛄ Colección Navidad 2026',
            '✨ Detalles artesanales modelados a mano',
            '☕ Ideal para chocolate navideño',
            '📅 Preventa con entrega estimada: 10 de Diciembre'
        ],
        imagenes: [
            '/imagenes/Artesanitas/reservas_navidad_2026/Taza_muneco_de_nieve_1.jpeg',
            '/imagenes/Artesanitas/reservas_navidad_2026/Taza_muñeco_de_nieve_1.jpeg'
        ]
    },
    {
        slug: 'taza-arbolito-chocolatosa',
        nombre: 'Taza Arbolito Chocolatosa',
        precio: 59.90,
        descripcion: 'Hermosa taza artesanal con relieve de árbol de Navidad en tono chocolate cálido, modelada y pintada a mano en cerámica fina.',
        detalles: [
            '🍫 Colección Navidad 2026',
            '✨ Cerámica artesanal esmaltada a mano',
            '☕ Para tus bebidas favoritas de temporada',
            '📅 Preventa con entrega estimada: 10 de Diciembre'
        ],
        imagenes: [
            '/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Chocolatosa.jpeg'
        ]
    },
    {
        slug: 'taza-arbolito-rosa',
        nombre: 'Taza Arbolito Rosa',
        precio: 59.90,
        descripcion: 'Delicado diseño artesanal con relieve de árbol de Navidad en tono rosa pastel, modelada y esmaltada a mano.',
        detalles: [
            '🌸 Colección Navidad 2026',
            '✨ Cerámica artesanal esmaltada a mano',
            '☕ Para tus bebidas favoritas de temporada',
            '📅 Preventa con entrega estimada: 10 de Diciembre'
        ],
        imagenes: [
            '/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Rosa.jpeg'
        ]
    },
    {
        slug: 'adorno-paltita',
        nombre: 'Adorno Paltita',
        precio: 35,
        descripcion: 'Adorno y macetero artesanal en forma de paltita con lazo, modelado y pintado a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_Paltita_1.jpeg']
    },
    {
        slug: 'taza-copa-piston',
        nombre: 'Taza Copa Pistón',
        precio: 59,
        descripcion: 'Taza de cerámica artesanal temática inspirada en la Copa Pistón, modelada y esmaltada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg']
    },
    {
        slug: 'adorno-oso-sentado',
        nombre: 'Adorno Oso sentado',
        precio: 32,
        descripcion: 'Tierno adorno y macetero de osito sentado con detalles de corazones pintados a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_oso_sentado_1.jpeg']
    },
    {
        slug: 'adorno-munequitas',
        nombre: 'Adorno muñequitas',
        precio: 29,
        descripcion: 'Delicado adorno de muñequita con corona de flores y plantita, modelado y pintado a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_munequita_con_plantita_1.jpeg']
    },

    {
        slug: 'taza-corazon-y-plato',
        nombre: 'Taza corazón y plato',
        precio: 75,
        descripcion: 'Incluye platito. Modelada a mano con esmalte satinado.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_corazón_y_ plato.jpeg']
    },
    {
        slug: 'taza-castellana',
        nombre: 'Taza Castellana',
        precio: 55,
        descripcion: 'Incluye platito. Diseño cálido y artesanal para uso diario.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_castellana.jpeg']
    },
    {
        slug: 'elefantitos-decorativos',
        nombre: 'Elefantitos decorativos',
        precio: 49,
        descripcion: 'Pieza decorativa para darle un toque especial a tu hogar.',
        imagenes: ['/imagenes/Artesanitas/Fotos/elefantitos_decorativos_1.jpeg']
    },
    {
        slug: 'taza-lavanda-abejita',
        nombre: 'Taza lavanda abejita',
        precio: 55,
        descripcion: 'Incluye platito. Diseño pintado a mano con detalles naturales.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_lavanda_abejita.jpeg']
    },
    {
        slug: 'elefantitos-decorativos-variante',
        nombre: 'Elefantitos decorativos (Variante)',
        precio: 49,
        descripcion: 'Pieza decorativa con detalles únicos para el hogar.',
        imagenes: ['/imagenes/Artesanitas/Fotos/elefantitos_decorativos_2.jpeg']
    },
    {
        slug: 'jarron-prada',
        nombre: 'Jarrón Prada',
        precio: 85,
        descripcion: 'Pieza escultural y elegante para decoración de interiores.',
        imagenes: ['/imagenes/Artesanitas/Fotos/jarron_prada.jpeg']
    },
    {
        slug: 'jarron-silueta-y-flores',
        nombre: 'Jarrón Silueta y Flores',
        precio: 85,
        descripcion: 'Jarrón de diseño artesanal con silueta orgánica.',
        imagenes: ['/imagenes/Artesanitas/Fotos/jarron_silueta_y_ flores.jpeg']
    },
    {
        slug: 'munequitas',
        nombre: 'Muñequitas',
        precio: 45,
        descripcion: 'Figura decorativa modelada y pintada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/muñequitas.jpeg']
    },
    {
        slug: 'taza-flor',
        nombre: 'Taza Flor',
        precio: 55,
        descripcion: 'Taza de cerámica con acabado rústico y detalles florales.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_flor.jpeg']
    },
    {
        slug: 'taza-noche-estrella',
        nombre: 'Taza noche estrella',
        precio: 69,
        descripcion: 'Incluye platito. Diseño inspirado en la noche estrellada.',
        imagenes: [
            '/imagenes/Artesanitas/Fotos/taza_noche_estrellada_1.jpeg',
            '/imagenes/Artesanitas/Fotos/taza_noche_estrella_2.jpeg'
        ]
    },
    // Visibilidad real controlada por negocio_productos_estaticos (pausar/activar
    // desde el panel admin) -- esta entrada se deja siempre activa aquí, el
    // pausado se filtra en artesanitas.routes.js antes de llegar a este archivo.
    // --- Variaciones Oficiales de Taza Rapunzel & Stich ---
    // Colores enteros (sin plato - S/ 65.00)
    {
        slug: 'taza-rapunzel-morada-sin-plato',
        nombre: 'Taza Rapunzel Morada (sin plato)',
        precio: 65.00,
        descripcion: 'Taza artesanal inspirada en Rapunzel, en color morado entero (sin plato), modelada y esmaltada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-rosa-flamenco-sin-plato',
        nombre: 'Taza Rapunzel Rosa Flamenco (sin plato)',
        precio: 65.00,
        descripcion: 'Taza artesanal inspirada en Rapunzel, en tono rosa flamenco entero (sin plato), modelada y esmaltada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_RosaFlamenco_sinplato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-palo-rosa-sin-plato',
        nombre: 'Taza Rapunzel Palo Rosa (sin plato)',
        precio: 65.00,
        descripcion: 'Taza artesanal inspirada en Rapunzel, en tono palo rosa entero (sin plato), modelada y esmaltada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Palo_Rosa_sin_plato_1.jpeg']
    },
    {
        slug: 'taza-stich',
        nombre: 'Taza Stich',
        precio: 65.00,
        descripcion: 'Taza artesanal temática de Stich pintada a mano con detalle "OHANA", modelada en cerámica fina.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_stich_2.jpeg']
    },
    // Taza con detalles (con líneas - S/ 69.90)
    {
        slug: 'taza-rapunzel-morada-lineas',
        nombre: 'Taza Rapunzel Morada con líneas',
        precio: 69.90,
        descripcion: 'Taza artesanal inspirada en Rapunzel en color morado con líneas texturizadas en relieve, modelada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-palo-rosa-lineas',
        nombre: 'Taza Rapunzel Palo Rosa con líneas',
        precio: 69.90,
        descripcion: 'Taza artesanal inspirada en Rapunzel en color palo rosa con líneas texturizadas en relieve, modelada a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg']
    },
    // Taza + Platito (S/ 89.90 y S/ 99.00)
    {
        slug: 'taza-rapunzel-morada-plato',
        nombre: 'Taza Rapunzel Morada + plato',
        precio: 89.90,
        descripcion: 'Set de Taza Rapunzel morada + platito a juego modelado y esmaltado a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_plato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-palo-rosa-plato',
        nombre: 'Taza Rapunzel Palo Rosa + plato',
        precio: 89.90,
        descripcion: 'Set de Taza Rapunzel palo rosa + platito a juego modelado y esmaltado a mano.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_Con-Plato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-morada-lineas-plato',
        nombre: 'Taza Rapunzel Morada con líneas + plato',
        precio: 99.00,
        descripcion: 'Set exclusivo de Taza Rapunzel morada con líneas texturizadas + platito artesanal a juego.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_lineas_y_plato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-palo-rosa-lineas-plato',
        nombre: 'Taza Rapunzel Palo Rosa con líneas + plato',
        precio: 99.00,
        descripcion: 'Set exclusivo de Taza Rapunzel palo rosa con líneas texturizadas + platito artesanal a juego.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con_lineas_y_plato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-palo-rosa',
        nombre: 'Taza Rapunzel Palo Rosa + plato',
        precio: 89.90,
        descripcion: 'Incluye platito. Diseño temático con acabado rosa pálido.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_Con-Plato_1.jpeg']
    },
    {
        slug: 'taza-rapunzel-moradito',
        nombre: 'Taza Rapunzel Morado + plato',
        precio: 89.90,
        descripcion: 'Incluye platito. Taza temática con esmalte morado vibrante.',
        imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_plato_1.jpeg']
    },
    {
        slug: 'taza-runner',
        nombre: 'Taza Runner',
        precio: 42,
        descripcion: 'Taza temática especial de cerámica para apasionados del running.',
        imagenes: ['/imagenes/Artesanitas/Fotos/taza_runner_1.jpeg']
    },
    // Visibilidad real controlada por negocio_productos_estaticos (pausar/activar
    // desde el panel admin) -- esta entrada se deja siempre activa aquí, el
    // pausado se filtra en artesanitas.routes.js antes de llegar a este archivo.
    {
        slug: 'tetera-corazon',
        nombre: 'Tetera Corazón',
        precio: 85,
        descripcion: 'Tetera de cerámica modelada a mano con detalles de corazones.',
        imagenes: [
            '/imagenes/Artesanitas/Fotos/tetera_corazon_1.jpeg',
            '/imagenes/Artesanitas/Fotos/tetera_corazon_2.jpeg',
            '/imagenes/Artesanitas/Fotos/tetera_corazon_3.jpeg',
            '/imagenes/Artesanitas/Fotos/tetera_corazon_4.jpeg'
        ]
    },
    {
        slug: 'taza-van-gogh',
        nombre: 'Taza Van Gogh',
        precio: 69,
        descripcion: 'Convierte cada taza de café o té en un momento especial con esta taza de cerámica inspirada en Van Gogh. Su diseño artístico y acabado pintado a mano hacen de cada pieza una pequeña obra de arte, perfecta para regalar o disfrutar en casa.',
        detalles: [
            '✨ Cerámica artesanal',
            '☕ Ideal para café, té, infusiones y chocolate caliente',
            '🔥 Apta para microondas'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_0.jpeg',
            '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_1.jpeg',
            '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_2.jpeg',
            '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_3.jpg'
        ]
    },
    {
        slug: 'azucarera-van-gogh',
        nombre: 'Azucarera Van Gogh',
        precio: 65,
        descripcion: 'Inspirada en la belleza de las pinceladas de Van Gogh, esta azucarera de cerámica pintada a mano aporta un toque artístico y elegante a tu mesa. Ideal para acompañar tus momentos de café o té, combinando funcionalidad y diseño en una pieza única.',
        detalles: [
            '✨ Cerámica artesanal',
            '☕ Ideal para azúcar, endulzantes o pequeños complementos',
            '🔥 Apta para lavavajillas'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/Azucarera_Van_Gogh_0.jpeg',
            '/imagenes/Artesanitas/Fotos/Azucarera_Van_Gogh_1.jpeg',
            '/imagenes/Artesanitas/Fotos/Azucarera_Van_Gogh_2.jpeg',
            '/imagenes/Artesanitas/Fotos/Azucarera_Van_Gogh_3.jpeg'
        ]
    },
    {
        slug: 'vasito-van-gogh',
        nombre: 'Vasito Van Gogh',
        precio: 59,
        descripcion: 'Disfruta tus bebidas favoritas en este vasito de cerámica inspirado en la icónica obra de Van Gogh. Cada pieza está pintada a mano, por lo que ninguna es igual a otra. Perfecto para café, té, chocolate caliente o cualquier bebida que quieras disfrutar con un toque de arte.',
        detalles: [
            '✨ Cerámica artesanal',
            '☕ Ideal para bebidas calientes y frías',
            '🔥 Apto para microondas'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/vasito_van_gogh_0.jpeg',
            '/imagenes/Artesanitas/Fotos/vasito_van_gogh_1.jpeg',
            '/imagenes/Artesanitas/Fotos/vasito_van_gogh_2.jpeg',
            '/imagenes/Artesanitas/Fotos/vasito_van_gogh_3.jpeg',
            '/imagenes/Artesanitas/Fotos/vasito_van_gogh_4.jpeg'
        ]
    },
    {
        slug: 'taza-piston-cup',
        nombre: 'Taza Piston Cup',
        precio: 59,
        descripcion: 'Taza de cerámica artesanal temática de Cars inspirada en la Piston Cup, modelada y pintada a mano. Ideal para regalar o coleccionar.',
        detalles: [
            '✨ Cerámica artesanal modelada a mano',
            '🏆 Diseño exclusivo temático de Cars / Piston Cup',
            '☕ Apta para bebidas calientes y frías'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg'
        ]
    },
    {
        slug: 'taza-formula-1',
        nombre: 'Taza Fórmula 1',
        precio: 69,
        descripcion: 'Para los amantes de la velocidad y los detalles únicos. Nuestras tazas de Fórmula 1 son perfectas para disfrutar tu café, chocolate o bebida favorita.',
        detalles: [
            'Cerámica artesanal modelada y pintada a mano',
            'Aptas para bebidas calientes y microondas',
            'Diseño artesanal hecho con mucho detalle'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/taza_formula1_1.jpg'
        ]
    },
    {
        slug: 'set-de-2-tazas-personalizadas',
        nombre: 'Set de 2 tazas personalizadas',
        precio: 149,
        descripcion: 'Un detalle único para compartir con esa persona especial. Incluye 2 tazas personalizadas y 2 platitos. Puedes elegir el color y la frase que prefieras.',
        detalles: [
            '✨ 2 tazas personalizadas',
            '🍽️ 2 platitos a juego',
            '🎨 Personaliza cada taza con la frase que prefieras'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/set_de_2_tazas_personalizadas_1.jpeg'
        ]
    },
    {
        slug: 'taza-artesanal-con-salpicado',
        nombre: 'Taza artesanal con salpicado',
        precio: 52,
        descripcion: 'Una taza con un estilo minimalista, cálido y único, perfecta para disfrutar tu café, té o bebida favorita. Su acabado en tono crema con delicadas salpicaduras oscuras le da ese toque artesanal y moderno.',
        detalles: [
            '✨ Hecha a mano en cerámica fina',
            '☕ Ideal para el día a día',
            '🎨 Estilo minimalista y cálido'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/taza_artesanal_con_salpicado_1.jpeg'
        ]
    },
    {
        slug: 'corazon-de-ceramica-para-pintar',
        nombre: 'Corazón de Cerámica para Pintar',
        precio: 65,
        descripcion: 'Un detalle lleno de amor para dejar volar tu creatividad. Este hermoso corazón de cerámica viene listo para que lo pintes y personalices a tu estilo.',
        detalles: [
            '🎨 Incluye kit de 5 pinturas',
            '🖌️ Incluye pinceles',
            '💜 Corazón de cerámica listo para pintar'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/corazon_ceramica_para_pintar_1.jpeg'
        ]
    },
    {
        slug: 'tazas-caspianas',
        nombre: 'Tazas Caspianas',
        precio: 58,
        descripcion: 'Hermosas tazas de cerámica artesanal con texturas y tonalidades orgánicas, modeladas a mano.',
        detalles: [
            '✨ Cerámica artesanal modelada a mano',
            '☕ Ideal para café o té',
            '🌿 Acabado cálido y texturizado'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/tazas_caspianas_1.jpeg'
        ]
    },
    {
        slug: 'taza-perry-el-ornitorrinco',
        nombre: 'Taza Perry el Ornitorrinco',
        precio: 65,
        descripcion: 'Taza temática de Perry el Ornitorrinco modelada y pintada a mano en cerámica de alta calidad.',
        detalles: [
            '✨ Modelada a mano',
            '🎨 Pintada con esmaltes seguros para consumo',
            '☕ Edición temática especial'
        ],
        imagenes: [
            '/imagenes/Artesanitas/Fotos/taza_perry_el_ornitorrinco_1.jpg'
        ]
    }
];

function getProductoPorSlug(slug) {
    return productos.find((p) => p.slug === slug) || null;
}

function urlWhatsapp(producto) {
    const texto = `Hola! Me gustaría consultar por la pieza: ${producto.nombre}`;
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

module.exports = { productos, PRODUCTOS_CATALOGO: productos, getProductoPorSlug, urlWhatsapp, WHATSAPP_NUMERO };
