# Privacidade

Esta política também é exibida na página "Sobre e metodologia" da aplicação.

- **Sem cadastro.** Não há login, conta, e-mail nem coleta de dados pessoais.
- **CEP.** Usado exclusivamente para validar entrega, frete e prazo. É enviado ao backend na
  pesquisa e **mascarado nos logs** (`74***-***`, configurável por `MASK_CEP_IN_LOGS`). No histórico
  de preços persistido grava-se apenas o prefixo (5 dígitos), nunca o CEP completo.
- **Armazenamento local.** Favoritos, histórico de pesquisas e preferências ficam no IndexedDB do
  navegador do usuário. O CEP só é salvo localmente se a pessoa marcar "Salvar meu CEP neste
  navegador". A página Favoritos tem botões para apagar histórico, apagar favoritos e limpar todos
  os dados locais.
- **Nada vai para o GitHub.** O repositório não recebe dados de usuários; o banco local (`app.db`)
  está no `.gitignore`.
- **Links externos.** As ofertas apontam para lojas externas, que seguem políticas próprias.
- **Telemetria.** Não há telemetria. Os logs do servidor são estruturados, anônimos e sem dados
  pessoais; podem ser desabilitados baixando o nível de log do processo.
- **Registros anônimos.** O backend registra apenas contagens agregadas por fonte
  (tabela `collection_log`): fonte consultada, status e número de ofertas.
