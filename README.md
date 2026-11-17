# DuduBat — Portfólio de Edição de Vídeos

Site estático (HTML, CSS e JavaScript puros, sem build e sem dependências externas).
Basta abrir em um servidor web ou publicar em qualquer hospedagem de arquivos estáticos.

## Estrutura

```
index.html            Estrutura e textos fixos das seções
favicon.svg           Ícone do morcego
css/style.css         Todo o visual (cores no topo, em :root)
js/config.js          ← TUDO que você edita: contatos, vídeos, sobre, serviços
js/main.js            Lógica (galeria, player, menu, animações)
assets/videos/        Arquivos de vídeo do portfólio
assets/thumbs/        Miniaturas dos vídeos
assets/img/           Imagem de compartilhamento, ícones e (opcional) sua foto
assets/fonts/         Fontes (Unbounded, Manrope, JetBrains Mono — licença OFL)
```

## Ver o site no seu computador

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Depois abra <http://localhost:8000>.

## Personalizar

Quase tudo é feito em **`js/config.js`**.

### 1. Contato (obrigatório antes de publicar)

Os botões de WhatsApp, Instagram e E-mail aparecem como "Configurar em js/config.js"
até você preencher:

```js
contact: {
  whatsapp: "",   // número com código do país e DDD, só números
  instagram: "",  // usuário, sem @
  email: "",      // seu e-mail
}
```

Assim que um campo é preenchido, o botão correspondente (na seção Contato e no rodapé) passa a funcionar.

### 2. Adicionar um vídeo novo

1. Copie o `.mp4` para `assets/videos/` (use nomes simples, sem espaços nem acentos).
   Prefira H.264 + AAC, que toca em todos os navegadores.
2. Gere a miniatura a partir do próprio vídeo (troque `5` pelo segundo do frame desejado):

   ```bash
   ffmpeg -ss 5 -i assets/videos/meu-video.mp4 -frames:v 1 -vf "scale=960:-2" -c:v libwebp -quality 80 assets/thumbs/meu-video.webp
   ```

   Recomendado para carregar rápido — move as informações do vídeo para o início do arquivo:

   ```bash
   ffmpeg -i original.mp4 -c copy -movflags +faststart assets/videos/meu-video.mp4
   ```

3. Em `js/config.js`, copie um bloco da lista `videos` e ajuste:

   ```js
   {
     title: "Nome do trabalho",        // se deixar "", vira "Projeto 06"
     file: "assets/videos/meu-video.mp4",
     thumb: "assets/thumbs/meu-video.webp",
     width: 1080, height: 1920,        // resolução real — define a proporção do card e do player
     duration: "0:30",
     categories: ["edits"]             // ids da lista `categories`
   }
   ```

A galeria se reorganiza sozinha e respeita a proporção de cada vídeo (horizontal, vertical ou quadrado).
Os vídeos só começam a ser baixados quando alguém clica para assistir.

### 3. Filtros da galeria

Edite a lista `categories` em `js/config.js`. Um filtro só aparece quando há pelo menos um vídeo nele.

### 4. Sobre mim

`about.paragraphs` contém o texto. Para usar uma foto, salve em `assets/img/` e informe o caminho em `about.photo`.

### 5. Serviços

A lista `services` é livre: apague, edite ou adicione blocos. Ícones disponíveis:
`social`, `vertical`, `long`, `creative`, `color`, `captions`.

### 6. Textos fixos e cores

- Textos do hero, títulos das seções e os quatro pilares estão em `index.html`.
- A paleta está no topo de `css/style.css`, em `:root`.

## Publicar

O site é só uma pasta de arquivos — funciona em qualquer hospedagem estática.

**GitHub Pages**: no repositório, vá em *Settings → Pages*, escolha *Deploy from a branch*,
selecione a branch e a pasta `/ (root)` e salve. O endereço aparece na mesma tela.

**Netlify / Vercel / Cloudflare Pages**: importe o repositório, sem comando de build,
com a pasta de publicação na raiz (`.`).

Depois de publicar, troque em `index.html` o valor de `og:image` e `twitter:image`
pelo endereço completo (ex.: `https://seu-dominio/assets/img/og.png`) — algumas redes
exigem URL absoluta para mostrar a imagem de prévia do link.
