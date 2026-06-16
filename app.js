// ==========================================================================
// BlueGift | Loveify - app.js (VERSÃO DE PRODUÇÃO CONSOLIDADA)
// Expert: Arquitetura Estável, Sincronização Robusta e Áudio Completo.
// ==========================================================================

// ==========================================
// 0. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE
// ==========================================
const SUPABASE_URL = "https://dslfazlbihgswdepmekl.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_CFx8YSapW8FF4VvJ72HIww_S5u13Jl1"; 

// Instância única e global do cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. VARIÁVEIS DE ESTADO E MAPEAMENTO DOM
// ==========================================
let currentStep = 1;
const totalSteps = 6;

// --- Elementos de Controle do Wizard ---
const btnVoltar = document.getElementById('btn-voltar');
const btnAvancar = document.getElementById('btn-avancar');
const btnPrevia = document.getElementById('btn-previa');
const stepIndicator = document.getElementById('step-indicator');
const progressBar = document.getElementById('progress-bar');
const previewSection = document.getElementById('preview-section');

// --- Todos os Inputs do Formulário ---
const inputSeuNome = document.getElementById('input-seu-nome');
const inputAmorNome = document.getElementById('input-amor-nome');
const inputData = document.getElementById('input-data');
const inputTitulo = document.getElementById('input-titulo');
const inputBuscaMusica = document.getElementById('input-busca-musica'); // Input de pesquisa
const inputNomeMusica = document.getElementById('input-nome-musica');   // Input de exibição/edição
const inputFotos = document.getElementById('input-fotos');
const inputMensagem = document.getElementById('input-mensagem');

// --- Elementos do Mockup (Prévia Smartphone) ---
const previewTituloTop = document.getElementById('preview-titulo');
const previewTrackName = document.getElementById('preview-track-name');
const previewCasal = document.getElementById('preview-casal');
const previewMensagem = document.getElementById('preview-mensagem');
const previewFotoPlaceholder = document.getElementById('preview-foto-placeholder');
const carouselContainer = document.getElementById('carousel-container');
const carouselDots = document.getElementById('carousel-dots');
const listaResultadosMusica = document.getElementById('lista-resultados-musica');

// --- Variáveis de Estado do Áudio (YouTube Mascarado) ---
let ytPlayerObjeto = null; 
let intervaloProgressoAudio = null;
let listaVideosAlternativos = [];
let indiceVideoAtual = 0;

// Dados estruturados da música selecionada para persistência no banco
let musicaSelecionadaDados = {
    nome: "",
    artista: "",
    youtube_busca_termo: "" // Salvaremos o termo exato de busca para o embed
};

// ==========================================
// 2. LÓGICA DO WIZARD (FLUXO DO FORMULÁRIO)
// ==========================================
function updateSteps() {
    // Atualiza os textos e barra de progresso do topo
    if (stepIndicator) stepIndicator.innerText = `Passo ${currentStep} de ${totalSteps}`;
    const progressPercent = (currentStep / totalSteps) * 100;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;

    // Gerencia visibilidade dos conteúdos dos passos
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.add('hidden');
    });
    
    const currentStepEl = document.getElementById(`step-${currentStep}`);
    if (currentStepEl) currentStepEl.classList.remove('hidden');

    // Controla o estado e texto dos botões de navegação
    btnVoltar.disabled = (currentStep === 1);
    btnAvancar.innerText = (currentStep === totalSteps) ? "Concluir" : "Avançar";
}

// --- Evento do Botão Avançar / Concluir ---
btnAvancar.addEventListener('click', async () => {
    if (currentStep < totalSteps) {
        currentStep++;
        updateSteps();
    } else {
        // --- Ação de Conclusão e Salvamento no Supabase ---
        
        // Validação básica de segurança
        if (!inputSeuNome.value.trim() || !inputAmorNome.value.trim() || !inputData.value) {
            alert("Por favor, preencha pelo menos os nomes e a data antes de concluir!");
            // Opcional: Voltar para o passo 1 automaticamente
            // currentStep = 1; updateSteps(); return;
            return;
        }

        try {
            // UI State: Bloqueia botão para evitar cliques duplos
            btnAvancar.disabled = true;
            btnAvancar.innerText = "Processando...";

            const files = inputFotos.files;
            const fotosUrlsSalvas = [];

            // --- FLUXO 1: Upload de Imagens para o Storage ---
            if (files.length > 0) {
                // Limita tecnicamente a 5 fotos no backend também
                const maxFotos = Math.min(files.length, 5);
                for (let i = 0; i < maxFotos; i++) {
                    const file = files[i];
                    const fileExt = file.name.split('.').pop();
                    // Gera nome único baseado em timestamp para evitar sobrescrita
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                    const filePath = `capas/${fileName}`;

                    let { error: uploadError } = await supabaseClient.storage
                        .from('fotos-presentes')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    // Captura a URL pública gerada
                    const { data: publicUrlData } = supabaseClient.storage
                        .from('fotos-presentes')
                        .getPublicUrl(filePath);

                    fotosUrlsSalvas.push(publicUrlData.publicUrl);
                }
            }

            // --- FLUXO 2: Persistência de Dados na Tabela 'presentes' ---
            
            // Mapeamento estrito colunas banco <-> inputs frontend
            const dadosDoPresente = {
                seu_nome: inputSeuNome.value.trim(),
                amor_nome: inputAmorNome.value.trim(),
                data_inicio: new Date(inputData.value).toISOString(), // Formato ISO Timestamp requerido
                titulo: inputTitulo.value.trim() || "Nossa Playlist de Amor",
                // Salva o termo de busca do YT na coluna URL para o embed do presente.html
                musica_url: musicaSelecionadaDados.youtube_busca_termo || "", 
                nome_musica: inputNomeMusica.value.trim() || "Nossa Música",
                mensagem: inputMensagem.value.trim(),
                fotos_urls: fotosUrlsSalvas // Array de strings
            };

            const { data, error } = await supabaseClient
                .from('presentes')
                .insert([dadosDoPresente])
                .select(); // Requer select() para retornar o ID gerado

            if (error) throw error;

            // --- FLUXO 3: Redirecionamento para Checkout ---
            if (data && data[0]) {
                const presenteCriado = data[0];
                // BUG FIX: Correção de 'presenteCreated' para 'presenteCriado'
                window.location.href = `planos.html?id=${presenteCriado.id}`;
            } else {
                throw new Error("Falha na persistência: Nenhum dado retornado.");
            }

        } catch (error) {
            console.error("Erro crítico no processo de conclusão:", error);
            alert("Houve um erro ao salvar o seu presente. Por favor, verifique os dados e tente novamente.");
            // UI State: Restaura botão
            btnAvancar.disabled = false;
            btnAvancar.innerText = "Concluir";
        }
    }
});

// --- Evento do Botão Voltar ---
btnVoltar.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateSteps();
    }
});

// --- Suporte Mobile: Rolagem para Prévia ---
if (btnPrevia) {
    btnPrevia.addEventListener('click', () => {
        if (previewSection) previewSection.scrollIntoView({ behavior: 'smooth' });
    });
}


// ==========================================
// 3. MOTOR DE SINCRONIZAÇÃO EM TEMPO REAL (LIVE PREVIEW)
// ==========================================

/**
 * Lógica combinada para atualizar o nome do casal (Artistas)
 * Formato: "Nome1 & Nome2" com fallbacks de segurança.
 */
function atualizarNomesPreview() {
    const seuNome = inputSeuNome.value.trim();
    const amorNome = inputAmorNome.value.trim();
    
    if (previewCasal) {
        if (seuNome && amorNome) {
            previewCasal.innerText = `${seuNome} & ${amorNome}`;
        } else if (seuNome || amorNome) {
            previewCasal.innerText = seuNome || amorNome;
        } else {
            // Fallback idêntico ao HTML original
            previewCasal.innerText = "Gabriel & Mariana"; 
        }
    }
}

// Escutas sincronizadas para os nomes
inputSeuNome.addEventListener('input', atualizarNomesPreview);
inputAmorNome.addEventListener('input', atualizarNomesPreview);

// Sincronização do Título (Topo do Player)
inputTitulo.addEventListener('input', () => {
    if (previewTituloTop) {
        previewTituloTop.innerText = inputTitulo.value.trim() || "Nossa Playlist de Amor";
    }
});

// Sincronização da Dedicatória (Mascara de Letra)
inputMensagem.addEventListener('input', () => {
    if (previewMensagem) {
        // BUG FIX: Uso de .trim() para evitar quebras com espaços
        previewMensagem.innerText = inputMensagem.value.trim() ? inputMensagem.value.trim() : `"Sua mensagem carinhosa aparecerá bem aqui..."`;
    }
});

// Sincronização do Nome da Música (Passo 4 editável)
inputNomeMusica.addEventListener('input', () => {
    if (previewTrackName) {
        previewTrackName.innerText = inputNomeMusica.value.trim() || "Nossa Playlist de Amor";
    }
});


// ==========================================================================
// 4. MOTOR DE ÁUDIO PROFISSIONAL (SPOTIFY SEARCH + YOUTUBE MASCARADO)
// ==========================================================================

// ==========================================
// CONFIGURAÇÕES DO SPOTIFY E YOUTUBE
// ==========================================
const SPOTIFY_CLIENT_ID = "28fc1438575a436c9c9701fd4f7a56a3";
const SPOTIFY_CLIENT_SECRET = "61539570971046c1a112aad40a123d7d";

// 🌟 ADICIONE ESTA LINHA:
const YOUTUBE_API_KEY = "AIzaSyDZwWn8Fvpf6r_wmJfsrAauIJFkAyJsyyw"; 
let spotifyAccessToken = "";
/**
 * Obtém ou renova Token de Acesso à API do Spotify (Client Credentials Flow)
 */
async function obterSpotifyToken() {
    if (spotifyAccessToken) return spotifyAccessToken;
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        spotifyAccessToken = data.access_token;
        return spotifyAccessToken;
    } catch (err) {
        console.error("Falha ao obter token Spotify:", err);
        return null;
    }
}

// --- Lógica de Busca no Spotify ---
let timeoutDebounceBusca = null;
inputBuscaMusica.addEventListener('input', () => {
    clearTimeout(timeoutDebounceBusca);
    const termo = inputBuscaMusica.value.trim();
    
    // Validação mínima de caracteres para busca
    if (termo.length < 2) {
        if (listaResultadosMusica) listaResultadosMusica.classList.add('hidden');
        return;
    }

    // Debounce de 400ms para economizar requisições de API
    timeoutDebounceBusca = setTimeout(async () => {
        try {
            const token = await obterSpotifyToken();
            if (!token) return;

            // BUG FIX: Correção de sintaxe template literal (faltava $)
            const urlBusca = `https://api.spotify.com/v1/search?q=${encodeURIComponent(termo)}&type=track&limit=5`;
            
            const res = await fetch(urlBusca, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.tracks && data.tracks.items) {
                renderizarResultadosSpotify(data.tracks.items);
            }
        } catch (err) {
            console.error("Erro na execução da busca Spotify:", err);
        }
    }, 400);
});

/**
 * Renderiza dinamicamente a lista de resultados da busca abaixo do input
 */
function renderizarResultadosSpotify(tracks) {
    listaResultadosMusica.innerHTML = '';
    if (!tracks || tracks.length === 0) {
        listaResultadosMusica.classList.add('hidden');
        return;
    }

    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer transition text-left text-slate-800";
        
        const capaImg = track.album.images[2]?.url || '';
        const nomeMusica = track.name;
        const artista = track.artists.map(a => a.name).join(', ');

        item.innerHTML = `
            <img src="${capaImg}" class="w-10 h-10 rounded object-cover">
            <div class="truncate flex-1">
                <p class="text-xs font-bold truncate">${nomeMusica}</p>
                <p class="text-[10px] text-slate-400 truncate">${artista}</p>
            </div>
        `;

        // Evento de clique modificado para enviar o ID correto diretamente para o player
        // Substitua APENAS o item.addEventListener('click', ...) dentro de renderizarResultadosMusica:
       item.addEventListener('click', async () => {
            const termoBuscaYT = `${nomeMusica} ${artista} official audio`;
            inputNomeMusica.value = `${nomeMusica} - ${artista}`;

            const elementoNomePreview = document.getElementById('preview-nome-musica');
            const elementoArtistaPreview = document.getElementById('preview-artista-musica');
            const elementoCapaPreview = document.getElementById('preview-capa-musica');

            if (elementoNomePreview) elementoNomePreview.textContent = nomeMusica;
            if (elementoArtistaPreview) elementoArtistaPreview.textContent = artista;
            if (elementoCapaPreview && track.album.images[0]?.url) {
                elementoCapaPreview.src = track.album.images[0].url;
            }
            
            listaResultadosMusica.classList.add('hidden');
            inputBuscaMusica.value = '';

            try {
                // ROTA OFICIAL E DEFINITIVA: YouTube Data API v3
               // Adicionamos o filtro '&videoEmbeddable=true' para ignorar vídeos bloqueados por gravadoras
const urlAPI = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(termoBuscaYT)}&type=video&videoEmbeddable=true&key=${YOUTUBE_API_KEY}&maxResults=5`;
                
                const res = await fetch(urlAPI);
                
                // Se a cota acabar ou a chave estiver errada, a API avisa
                if (!res.ok) {
                    throw new Error(`Erro na API Oficial: ${res.status}`);
                }

                const data = await res.json();
                const videoId = data.items[0]?.id?.videoId;

                if (videoId) {
                    musicaSelecionadaDados = { nome: nomeMusica, artista: artista, youtube_id: videoId };
                    carregarYoutubePlayerInvisivel(videoId);
                } else {
                    alert("Não encontramos um vídeo correspondente no YouTube para esta música.");
                }

            } catch (err) {
                console.error("Erro na busca oficial do YouTube:", err);
                alert("Falha ao sincronizar o áudio. Verifique se a sua chave (API Key) do YouTube está correta e ativa.");
            }
        });
        listaResultadosMusica.appendChild(item);
    });

    listaResultadosMusica.classList.remove('hidden');
}

// Inicializa o Player do YouTube de forma Oculta passando o videoId DIRETO
// Inicializa o Player ou apenas carrega uma nova música se ele já existir
function carregarYoutubePlayerInvisivel(videoId) {
    if (ytPlayerObjeto && typeof ytPlayerObjeto.loadVideoById === 'function') {
        ytPlayerObjeto.loadVideoById(videoId);
        return;
    }

    let containerFalso = document.getElementById('yt-player-invisivel-container');
    
    if (!containerFalso) {
        containerFalso = document.createElement('div');
        containerFalso.id = 'yt-player-invisivel-container';
        
        // 🌟 TRUQUE DA LOVEPANDA: O player fica na tela, mas camuflado pelo CSS
        containerFalso.style.position = 'fixed';
        containerFalso.style.bottom = '10px';
        containerFalso.style.right = '10px';
        containerFalso.style.width = '200px';
        containerFalso.style.height = '200px';
        containerFalso.style.zIndex = '-1'; // Fica atrás de todo o layout do seu site
        containerFalso.style.pointerEvents = 'none'; // Ninguém consegue clicar nele
        containerFalso.style.opacity = '0.01'; // Quase invisível, mas o navegador ainda processa
        
        document.body.appendChild(containerFalso);
    }

    containerFalso.innerHTML = `<div id="yt-iframe-placeholder"></div>`;

    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = () => {
            criarObjetoYTPlayer(videoId);
        };
    } else {
        criarObjetoYTPlayer(videoId);
    }
}

// Construtor do Player ajustado
function criarObjetoYTPlayer(videoId) {
    if (typeof YT === 'undefined' || !YT.Player) return;

    ytPlayerObjeto = new YT.Player('yt-iframe-placeholder', {
        height: '100%',
        width: '100%',
        videoId: videoId, 
        playerVars: {
            'enablejsapi': 1,
            'origin': window.location.origin, 
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerMascaraReady,
            'onStateChange': onPlayerMascaraStateChange
        }
    });
}
/**
 * Evento: Player carregou a busca e está pronto
 */
function onPlayerMascaraReady(event) {
    // Sincroniza o botão de Play do Mockup que já está no HTML
    sincronizarBotaoPlayMockup();
}

/**
 * Evento: Mudança de estado (tocando, pausado, bufferizando)
 */
function onPlayerMascaraStateChange(event) {
    const btnPlayPause = document.getElementById('btn-play-pause');
    if (!btnPlayPause) return;
    
    const icone = btnPlayPause.querySelector('i');
    if (!icone) return;

    if (event.data === YT.PlayerState.PLAYING) {
        icone.className = "fas fa-pause text-xl";
    } else {
        icone.className = "fas fa-play text-xl ml-0.5";
    }
}

/**
 * Atribui a lógica de clique ao botão de play central do mockup no HTML
 */
function sincronizarBotaoPlayMockup() {
    const btnPlayFalso = document.getElementById('btn-play-falso');
    
    if (btnPlayFalso) {
        // Engenharia de Eventos: Clona e substitui para garantir que não existam listeners duplicados
        const novoBtnPlay = btnPlayFalso.cloneNode(true);
        btnPlayFalso.parentNode.replaceChild(novoBtnPlay, btnPlayFalso);

        novoBtnPlay.addEventListener('click', () => {
            // Segurança: verifica integridade do objeto da API
            if (!ytPlayerObjeto || typeof ytPlayerObjeto.getPlayerState !== 'function') return;
            
            const estadoAtual = ytPlayerObjeto.getPlayerState();
            // Ponte de comando entre visual Spotify e motor YouTube
            if (estadoAtual === YT.PlayerState.PLAYING) {
                ytPlayerObjeto.pauseVideo();
            } else {
                ytPlayerObjeto.playVideo();
            }
        });
    }
}

/**
 * Utilitário: Formata segundos para MM:SS (padrão Spotify)
 */
function formatarTempoSpotify(segundos) {
    const minutos = Math.floor(segundos / 60);
    const segsRestantes = Math.floor(segundos % 60);
    return `${minutos}:${segsRestantes < 10 ? '0' : ''}${segsRestantes}`;
}


// ==========================================
// 5. CARROSSEL DE FOTOS (LIVE PREVIEW)
// ==========================================
inputFotos.addEventListener('change', (e) => {
    // Aceita múltiplas, mas processa apenas as primeiras 5
    const files = Array.from(e.target.files).slice(0, 5);
    
    if (files.length === 0) {
        if (previewFotoPlaceholder) previewFotoPlaceholder.classList.remove('hidden');
        if (carouselContainer) carouselContainer.classList.add('hidden');
        if (carouselDots) carouselDots.classList.add('hidden');
        return;
    }

    // Limpa containers anteriores
    if (carouselContainer) carouselContainer.innerHTML = '';
    if (carouselDots) carouselDots.innerHTML = '';
    
    // UI State: Mostra carrossel, esconde placeholder de coração
    if (previewFotoPlaceholder) previewFotoPlaceholder.classList.add('hidden');
    if (carouselContainer) carouselContainer.classList.remove('hidden');
    if (carouselDots) carouselDots.classList.remove('hidden');

    files.forEach((file, index) => {
        const reader = new FileReader();
        // Callback ao finalizar leitura local do arquivo
        reader.onload = (event) => {
            // Cria slide (imagem)
            const imgDiv = document.createElement('div');
            imgDiv.className = "w-full h-full flex-shrink-0 snap-start select-none";
            // pointer-events-none impede o "arrastar" padrão da imagem que quebra o scroll
            imgDiv.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover pointer-events-none">`;
            if (carouselContainer) carouselContainer.appendChild(imgDiv);

            // Cria indicador (ponto/dot)
            const dot = document.createElement('span');
            dot.id = `dot-${index}`;
            // Estilização base + condicional para o primeiro ativo
            dot.className = `h-2 rounded-full transition-all duration-300 ${index === 0 ? 'bg-white w-4' : 'bg-white/40 w-2'}`;
            if (carouselDots) carouselDots.appendChild(dot);
        };
        // Inicia leitura como DataURL para preview local instantâneo
        reader.readAsDataURL(file);
    });
});

/**
 * Lógica de sincronização dos pontos do carrossel baseada na rolagem (scroll)
 */
if (carouselContainer) {
    carouselContainer.addEventListener('scroll', () => {
        // Calcula índice ativo baseado na largura visível e posição do scroll
        const width = carouselContainer.offsetWidth;
        const activeIndex = Math.round(carouselContainer.scrollLeft / width);
        
        const dots = carouselDots.querySelectorAll('span');
        dots.forEach((dot, idx) => {
            // Atualiza classes Tailwind para destacar ponto ativo (w-4 vs w-2)
            if (idx === activeIndex) {
                dot.className = "h-2 rounded-full transition-all duration-300 bg-white w-4";
            } else {
                dot.className = "h-2 rounded-full transition-all duration-300 bg-white/40 w-2";
            }
        });
    });
}


// ==========================================
// 6. CONTADOR DE TEMPO JUNTOS (LIVE PREVIEW)
// ==========================================
let intervaloCronometro = null;

inputData.addEventListener('input', () => {
    // Se limpar o campo, para e reseta preview
    if (!inputData.value) {
        clearInterval(intervaloCronometro);
        resetarContadorPreview();
        return;
    }

    // Evita múltiplos intervalos rodando ao mesmo tempo
    clearInterval(intervaloCronometro);

    // Inicia loop de 1 segundo
    intervaloCronometro = setInterval(() => {
        const agora = new Date();
        const inicioCasal = new Date(inputData.value);
        // Diferença em milissegundos
        let diferencaMili = agora - inicioCasal;

        // Se data for futura, exibe zerado (evita contagem regressiva)
        if (diferencaMili < 0) {
            resetarContadorPreview();
            return;
        }

        // Cálculos matemáticos de tempo
        const dias = Math.floor(diferencaMili / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencaMili % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferencaMili % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferencaMili % (1000 * 60)) / 1000);

        // Atualiza o DOM
        atualizarContadorDOM(dias, horas, minutos, segundos);
    }, 1000);
});

/**
 * Utilitário: Adiciona zero à esquerda (ex: 9 -> 09)
 */
function padZero(num) {
    return String(num).padStart(2, '0');
}

/**
 * Atualiza os blocos HTML do contador com animação de pulse no segundo
 */
function atualizarContadorDOM(d, h, m, s) {
    const previewContador = document.getElementById('preview-contador');
    if (!previewContador) return;
    
    // Injeção de HTML mantendo as classes Tailwind originais do design
    previewContador.innerHTML = `
        <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${padZero(d)}</span><span class="text-[7px] uppercase text-neutral-400">Dias</span></div>
        <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${padZero(h)}</span><span class="text-[7px] uppercase text-neutral-400">Horas</span></div>
        <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${padZero(m)}</span><span class="text-[7px] uppercase text-neutral-400">Min</span></div>
        <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-[#1ED760] animate-pulse">${padZero(s)}</span><span class="text-[7px] uppercase text-neutral-400">Seg</span></div>
    `;
}

function resetarContadorPreview() {
    atualizarContadorDOM(0, 0, 0, 0);
}


// ==========================================
// 7. INICIALIZAÇÃO PÓS-CARREGAMENTO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Garante estado inicial correto do wizard
    updateSteps();
    // Preenche nomes padrão no preview
    atualizarNomesPreview();
});

// CONTROLE DE PLAY / PAUSE DO PLAYER DO YOUTUBE
const btnPlayPause = document.getElementById('btn-play-pause');

if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
        // Valida se o player do YouTube está pronto
        if (!ytPlayerObjeto || typeof ytPlayerObjeto.getPlayerState !== 'function') return;

        const estadoAtual = ytPlayerObjeto.getPlayerState();
        const icone = btnPlayPause.querySelector('i');

        // Se estiver TOCANDO (1), o clique vai PAUSAR a música
        if (estadoAtual === 1) {
            ytPlayerObjeto.pauseVideo();
            if (icone) {
                // Exibe o ícone de Play com o ajuste óptico 'ml-0.5' para centralizar o triângulo
                icone.className = "fas fa-play text-xl ml-0.5";
            }
        } 
        // Se estiver PAUSADO (2) ou não iniciado, o clique vai DAR PLAY
        else {
            ytPlayerObjeto.playVideo();
            if (icone) {
                // Exibe o ícone de Pause (symmetrical, não precisa do 'ml-0.5')
                icone.className = "fas fa-pause text-xl";
            }
        }
    });
}