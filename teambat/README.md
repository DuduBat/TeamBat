# TeamBat — Science Based Lifting

Plataforma de acompanhamento de treinamento com dois ambientes:

- **Área do aluno** — treino do dia, ficha, registro de carga e repetições por série, histórico e evolução.
- **Painel do treinador** — dashboard, alunos, montagem de fichas, biblioteca de exercícios e progressão exercício por exercício.

É um sistema completo (servidor + banco de dados + app web), sem dependências externas:
Node.js 22 com o SQLite que já vem embutido nele. Não há `npm install`.

## Rodar no computador

Requisito: [Node.js](https://nodejs.org) 22.13 ou mais novo.

```bash
cd teambat
npm start
```

Abra <http://localhost:3000>. No primeiro acesso o app pede para **criar a conta do treinador**.
Nessa tela dá para incluir os dados de demonstração.

O banco fica em `teambat/data/teambat.db` (um arquivo só — é ele que você copia para fazer backup).

## Dados de demonstração

São três alunos **fictícios**, gerados por fórmula em `lib/demo.js`, com fichas e cerca de sete semanas
de treinos. Aparecem sempre com o selo **DEMO** e não representam pessoas reais.

- Carregar ou remover: **Configurações → Dados de demonstração**.
- Para ver a área do aluno: entre com `demo.a@teambat.demo` (ou `demo.b`, `demo.c`) e a senha `demo1234`.
- Remova essas contas antes de usar o app com alunos de verdade: a senha delas é pública.

## Como funciona o acesso

| | Aluno | Treinador |
|---|---|---|
| Entra com | e-mail + senha | e-mail + senha |
| Vê | só a própria ficha, treinos e evolução | todos os alunos |
| Conta criada por | treinador (senha provisória, trocada no 1º acesso) | tela de configuração inicial |

- Senhas guardadas com `scrypt` (nunca em texto puro); sessão em cookie `HttpOnly`.
- Toda rota da API confere o dono do dado no servidor: um aluno não consegue ler nem alterar nada de outro aluno,
  mesmo chamando a API diretamente. Isso está coberto pelos testes.
- Desativar um aluno ou gerar nova senha encerra as sessões dele na hora.
- Editar a ficha não altera o histórico: cada treino guarda uma cópia da prescrição do dia.

## Publicar na internet

Para os alunos acessarem do celular, o app precisa estar em um servidor com **disco persistente**
(o banco é um arquivo) e **HTTPS**.

**Render** — o arquivo `render.yaml` já descreve tudo: em *New → Blueprint*, aponte para este repositório.
Ele cria o serviço, o disco em `/data` e um `SETUP_TOKEN` (veja em *Environment*), que a tela de
configuração inicial vai pedir como "código de instalação".

**Qualquer servidor com Docker**

```bash
docker build -t teambat teambat
docker run -d -p 3000:3000 -v teambat-data:/data -e COOKIE_SECURE=1 -e SETUP_TOKEN=escolha-um-codigo teambat
```

Coloque um proxy com HTTPS na frente (Caddy, Nginx, Cloudflare).

### Variáveis de ambiente

| Variável | Para quê | Padrão |
|---|---|---|
| `PORT` | porta do servidor | `3000` |
| `DATA_DIR` | pasta do banco de dados | `./data` |
| `APP_TIMEZONE` | fuso usado em semanas e datas | `America/Sao_Paulo` |
| `COOKIE_SECURE` | `1` para exigir HTTPS no cookie de sessão | automático atrás de proxy HTTPS |
| `SETUP_TOKEN` | código exigido para criar a conta do treinador | sem código |

Defina `SETUP_TOKEN` em qualquer servidor público: sem ele, a primeira pessoa que abrir o endereço
pode criar a conta do treinador.

## Testes

```bash
npm test
```

Roda os fluxos principais e as regras de permissão contra um banco em memória (não toca nos dados reais).

## Estrutura

```
server.js            Servidor HTTP, banco (schema), autenticação e todas as rotas da API
lib/library.js       Grupos musculares e biblioteca inicial de exercícios
lib/demo.js          Gerador dos dados de demonstração
public/index.html    Casca do app
public/css/app.css   Identidade visual (mesmos tokens do portfólio DuduBat)
public/js/core.js    API, formatação, modal, avisos, ícones, ilustrações
public/js/charts.js  Gráficos (linha e barras) em SVG
public/js/progress.js  Progressão por exercício (aluno e treinador)
public/js/student.js   Área do aluno
public/js/admin.js     Painel do treinador
public/js/app.js       Login, navegação e rotas
test/api.test.js     Testes da API
```

Para adicionar uma funcionalidade: crie a rota em `server.js` (com o papel `ADMIN`, `STUDENT` ou `ANY`)
e a tela no arquivo da área correspondente, registrando-a em `NAV` (`public/js/app.js`).

## Limites conhecidos

- A ilustração dos exercícios é um desenho por grupo muscular; o treinador pode enviar uma imagem própria por exercício.
- Se a conexão cair durante o treino, as séries digitadas ficam guardadas no aparelho e são reenviadas depois,
  mas o app não abre sem internet.
- Recuperação de senha é feita pelo treinador (botão "Nova senha"); não há envio de e-mail.
