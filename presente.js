let presenteYtPlayer = null;
// ==========================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://dslfazlbihgswdepmekl.supabase.co";
const SUPABASE_KEY = "sb_publishable_CFx8YSapW8FF4VvJ72HIww_S5u13Jl1";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. CAPTURA DOS ELEMENTOS DO HTML
// ==========================================
const loadingScreen = document.getElementById('loading-screen');
const mainContent = document.getElementById('main-content');
const viewTitulo = document.getElementById('view-titulo');
const viewTrackName = document.getElementById('view-track-name');
const viewCasal = document.getElementById('view-casal');
const viewMensagem = document.getElementById('view-mensagem');
const viewCarousel = document.getElementById('view-carousel');
const viewDots = document.getElementById('view-dots');
const viewPlayerWrapper = document.getElementById('view-player-wrapper');

let intervaloContador = null;

// ==========================================
// 3. FUNÇÃO PRINCIPAL: CAPTURAR DADOS DO BANCO
// ==========================================
async function carregarPresente() {
    try {
        // Pega o ID que está vindo na URL do navegador (Ex: ?id=abcd-1234)
        const urlParams = new URLSearchParams(window.location.search);
        const presenteId = urlParams.get('id');

        if (!presenteId) {
            alert("Link inválido ou sem código identificador!");
            return;
        }

        // Faz a busca na tabela "presentes" pelo ID correspondente
        const { data, error } = await supabase
            .from('presentes')
            .select('*')
            .eq('id', presenteId)
            .single(); // .single() garante que trará apenas 1 objeto e não uma lista

        if (error || !data) throw error;

        // SE DEU CERTO, APENAS COLOQUE OS DADOS DO BANCO NA TELA!
        preencherDadosNaTela(data);

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        viewMensagem.innerText = "Erro ao carregar este presente. Verifique o link.";
        loadingScreen.classList.add('hidden');
    }
}

// ==========================================
// 4. FUNÇÃO AUXILIAR: DISTRIBUIR OS DADOS
// ==========================================
function preencherDadosNaTela(dados) {
    viewTitulo.innerText = dados.titulo;
    viewCasal.innerText = `${dados.seu_nome} & ${dados.amor_nome}`;
    viewMensagem.innerText = dados.mensagem;
    if (viewTrackName) viewTrackName.innerText = dados.nome_musica || "Nossa Música";

    // CARREGA O AUDIO COMPLETO DO YOUTUBE SALVO
    if (dados.musica_url) {
        // Cria a div invisível do YouTube na página do presente
        const containerInvisivel = document.createElement('div');
        containerInvisivel.style.position = 'absolute';
        containerInvisivel.style.width = '1px';
        containerInvisivel.style.height = '1px';
        containerInvisivel.style.opacity = '0';
        containerInvisivel.innerHTML = `<div id="view-yt-placeholder"></div>`;
        document.body.appendChild(containerInvisivel);

        // Ativa a API do YouTube na página final
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);

        window.onYouTubeIframeAPIReady = () => {
            presenteYtPlayer = new YT.Player('view-yt-placeholder', {
                height: '1',
                width: '1',
                videoId: dados.musica_url, // Lê o ID salvo
                playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1 },
                events: {
                    'onStateChange': (event) => {
                        const iconePlay = document.getElementById('view-icone-play');
                        if (!iconePlay) return;

                        if (event.data === YT.PlayerState.PLAYING) {
                            iconePlay.className = "fas fa-pause-circle";
                            
                            // Atualiza a barra de progresso real da música inteira
                            setInterval(() => {
                                const atual = presenteYtPlayer.getCurrentTime();
                                const total = presenteYtPlayer.getDuration() || 1;
                                const pct = (atual / total) * 100;
                                
                                document.getElementById('view-barra-progresso').style.width = `${pct}%`;
                                document.getElementById('view-tempo-atual').innerText = formatarTempo(atual);
                                document.getElementById('view-tempo-total').innerText = formatarTempo(total);
                            }, 500);
                        } else {
                            iconePlay.className = "fas fa-play-circle";
                        }
                    }
                }
            });
        };
    }

    // Configura o clique do botão de play da página final do parceiro
    setTimeout(() => {
        const btnPlayFinal = document.getElementById('view-btn-play');
        if (btnPlayFinal) {
            btnPlayFinal.addEventListener('click', () => {
                if (!presenteYtPlayer) return;
                const estado = presenteYtPlayer.getPlayerState();
                if (estado === YT.PlayerState.PLAYING) {
                    presenteYtPlayer.pauseVideo();
                } else {
                    presenteYtPlayer.playVideo();
                }
            });
        }
    }, 1000);
    

function formatarTempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const segs = Math.floor(segundos % 60);
    return `${mins}:${segs < 10 ? '0' : ''}${segs}`;
}

    // Iniciar o Contador
    iniciarContador(dados.data_inicio);

    // Efeito de transição suave para sumir com o loading
    loadingScreen.classList.add('opacity-0');
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        mainContent.classList.remove('hidden');
        setTimeout(() => mainContent.classList.remove('opacity-0'), 50);
    }, 500);
}
 

// ==========================================
// 5. CRONÔMETRO DE TEMPO REAL
// ==========================================
function iniciarContador(dataInicio) {
    const viewContador = document.getElementById('view-contador');
    
    intervaloContador = setInterval(() => {
        const agora = new Date();
        const inicio = new Date(dataInicio);
        let diferenca = agora - inicio;

        if (diferenca < 0) return;

        const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferenca % (1000 * 60)) / 1000);

        const pad = (num) => String(num).padStart(2, '0');

        viewContador.innerHTML = `
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${pad(dias)}</span><span class="text-[7px] uppercase text-neutral-400">Dias</span></div>
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${pad(horas)}</span><span class="text-[7px] uppercase text-neutral-400">Horas</span></div>
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${pad(minutos)}</span><span class="text-[7px] uppercase text-neutral-400">Min</span></div>
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-[#1ED760] animate-pulse">${pad(segundos)}</span><span class="text-[7px] uppercase text-neutral-400">Seg</span></div>
        `;
    }, 1000);
}

// Dispara a leitura assim que a página abre
carregarPresente();