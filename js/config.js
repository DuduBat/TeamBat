/* ==========================================================================
   DUDUBAT — CONFIGURAÇÃO DO SITE
   --------------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar para personalizar o site:
   contatos, vídeos do portfólio, texto "Sobre mim" e serviços.
   Depois de editar, salve o arquivo e recarregue a página.
   ========================================================================== */

window.DUDUBAT = {

  /* ------------------------------------------------------------------------
     1. CONTATO
     Preencha os campos abaixo. Enquanto um campo estiver vazio (""), o botão
     correspondente aparece como "não configurado" e não leva a lugar nenhum.
     ------------------------------------------------------------------------ */
  contact: {
    // WhatsApp: número completo com código do país e DDD, só números.
    // Exemplo de formato: "5511999999999"
    whatsapp: "5531982521266",

    // Mensagem que já vem escrita quando a pessoa abre o WhatsApp.
    whatsappMessage: "Olá, DuduBat! Vi seu portfólio e quero conversar sobre um projeto.",

    // Instagram: apenas o nome de usuário, sem @. Exemplo de formato: "seuusuario"
    instagram: "dudu_bat",

    // E-mail de contato. Exemplo de formato: "voce@seudominio.com"
    email: "eduandradegimenes@gmail.com",

    // Assunto que já vem preenchido no e-mail.
    emailSubject: "Projeto de edição de vídeo"
  },

  /* ------------------------------------------------------------------------
     2. SOBRE MIM
     ------------------------------------------------------------------------ */
  about: {
    // Foto ou avatar (opcional). Coloque a imagem em assets/img/ e escreva o
    // caminho aqui, por exemplo: "assets/img/foto.jpg".
    // Deixe "" para usar o símbolo do morcego no lugar.
    photo: "",

    // Cada item da lista é um parágrafo.
    paragraphs: [
      "Sou DuduBat, editor de vídeos e criador visual. Gosto de transformar ideias em conteúdos que despertam interesse, comunicam mensagens e prendem a atenção.",
      "Acredito que uma boa edição vai muito além de juntar cenas: envolve ritmo, criatividade, escolhas visuais e atenção aos detalhes."
    ]
  },

  /* ------------------------------------------------------------------------
     3. PORTFÓLIO
     Para adicionar um novo trabalho:
       1. Coloque o vídeo (.mp4) em  assets/videos/
       2. Coloque a miniatura em     assets/thumbs/   (veja o README.md)
       3. Copie um dos blocos abaixo e ajuste os campos.
     A ordem da lista é a ordem em que os vídeos aparecem no site.
     ------------------------------------------------------------------------ */

  // Filtros da galeria. "Todos" é criado automaticamente.
  // Um filtro só aparece se existir pelo menos um vídeo nele.
  categories: [
    { id: "edits", label: "Edits" },
    { id: "vlogs", label: "Vlogs" }
  ],

  videos: [
    {
      title: "I'm choose death...",
      file: "assets/videos/im-choose-death.mp4",
      thumb: "assets/thumbs/im-choose-death.webp",
      width: 1280, height: 720,      // resolução original (define a proporção)
      duration: "0:16",
      categories: ["edits"]
    },
    {
      title: "Talvez um dia você me permita...",
      file: "assets/videos/talvez-um-dia-voce-me-permita.mp4",
      thumb: "assets/thumbs/talvez-um-dia-voce-me-permita.webp",
      width: 1280, height: 720,
      duration: "0:15",
      categories: ["edits"]
    },
    {
      title: "Sometimes...",
      file: "assets/videos/sometimes.mp4",
      thumb: "assets/thumbs/sometimes.webp",
      width: 960, height: 720,
      duration: "0:23",
      categories: ["edits", "vlogs"]
    },
    {
      title: "BH é nois",
      file: "assets/videos/bh-e-nois.mp4",
      thumb: "assets/thumbs/bh-e-nois.webp",
      width: 720, height: 720,
      duration: "1:08",
      categories: ["vlogs"]
    },
    {
      title: "For real...",
      file: "assets/videos/for-real.mp4",
      thumb: "assets/thumbs/for-real.webp",
      width: 960, height: 720,
      duration: "0:19",
      categories: ["edits"]
    }
  ],

  /* ------------------------------------------------------------------------
     4. SERVIÇOS
     Lista editável: apague, altere ou adicione blocos à vontade.
     Ícones disponíveis: "social", "vertical", "long", "creative", "color", "captions"
     ------------------------------------------------------------------------ */
  services: [
    {
      icon: "social",
      title: "Edição para redes sociais",
      description: "Conteúdos dinâmicos para plataformas sociais.",
      items: ["Cortes e ritmo", "Organização visual"]
    },
    {
      icon: "vertical",
      title: "Edição de vídeos curtos",
      description: "Conteúdos verticais pensados para consumo rápido.",
      items: ["Reels", "Shorts", "Vídeos rápidos"]
    },
    {
      icon: "long",
      title: "Edição de vídeos longos",
      description: "Construção de uma experiência audiovisual do início ao fim.",
      items: ["Organização de cenas", "Ritmo narrativo"]
    },
    {
      icon: "creative",
      title: "Edição criativa",
      description: "Recursos visuais que dão personalidade ao conteúdo.",
      items: ["Transições", "Efeitos visuais", "Composições", "Animações"]
    },
    {
      icon: "color",
      title: "Tratamento visual",
      description: "Acabamento de imagem coerente com a proposta do vídeo.",
      items: ["Ajustes de cor", "Contraste", "Correções de imagem"]
    },
    {
      icon: "captions",
      title: "Legendas e elementos gráficos",
      description: "Texto e grafismos integrados à edição.",
      items: ["Textos animados", "Legendas estilizadas", "Elementos personalizados"]
    }
  ]
};
