// ==========================================================================
// BlueGift | Loveify - app.js (VERSÃO BLINDADA)
// Proteção contra quebra de DOM e correção de variáveis.
// ==========================================================================

// ==========================================
// 0. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE
// ==========================================
const SUPABASE_URL = "https://dslfazlbihgswdepmekl.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_CFx8YSapW8FF4VvJ72HIww_S5u13Jl1"; 

// Instância única e global do cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. VARIÁVEIS DE ESTADO GLOBAIS
// ==========================================
let currentStep = 1;
const totalSteps = 6;

// Variáveis de Estado do Áudio e Spotify
let ytPlayerObjeto = null; 
let spotifyAccessToken = "";
let timeoutDebounceBusca = null;
let intervaloCronometro = null;

let musicaSelecionadaDados = {
    nome: "",
    artista: "",
    youtube_busca_termo: ""
};

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY; 

// ==========================================
// 2. INICIALIZAÇÃO SEGURA (GARANTE QUE O HTML CARREGOU)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Mapeamento DOM ---
    const btnVoltar = document.getElementById('btn-voltar');
    const btnAvancar = document.getElementById('btn-avancar');
    const btnPrevia = document.getElementById('btn-previa');
    const stepIndicator = document.getElementById('step-indicator');
    const progressBar = document.getElementById('progress-bar');
    const previewSection = document.getElementById('preview-section');
    const btnPlayPause = document.getElementById('btn-play-pause');

    const inputSeuNome = document.getElementById('input-seu-nome');
    const inputAmorNome = document.getElementById('input-amor-nome');
    const inputData = document.getElementById('input-data');
    const inputTitulo = document.getElementById('input-titulo');
    const inputBuscaMusica = document.getElementById('input-busca-musica');
    const inputNomeMusica = document.getElementById('input-nome-musica');
    const inputFotos = document.getElementById('input-fotos');
    const inputMensagem = document.getElementById('input-mensagem');
    const inputFotoCapaHistoria = document.getElementById('input-foto-capa-historia');

    const previewTituloTop = document.getElementById('preview-titulo');
    const previewTrackName = document.getElementById('preview-track-name');
    const previewCasal = document.getElementById('preview-casal');
    const previewMensagem = document.getElementById('preview-mensagem');
    const previewFotoPlaceholder = document.getElementById('preview-foto-placeholder');
    const carouselContainer = document.getElementById('carousel-container');
    const carouselDots = document.getElementById('carousel-dots');
    const listaResultadosMusica = document.getElementById('lista-resultados-musica');

    // --- Funções Internas ---
    
    function alternarVisualBotao(estaTocando) {
        if (!btnPlayPause) return;
        if (estaTocando) {
            btnPlayPause.innerHTML = '<i class="fas fa-pause text-xl"></i>';
        } else {
            btnPlayPause.innerHTML = '<i class="fas fa-play text-xl ml-0.5"></i>';
        }
    }

    function updateSteps() {
        if (stepIndicator) stepIndicator.innerText = `Passo ${currentStep} de ${totalSteps}`;
        if (progressBar) {
            const progressPercent = (currentStep / totalSteps) * 100;
            progressBar.style.width = `${progressPercent}%`;
        }

        document.querySelectorAll('.step-content').forEach(step => step.classList.add('hidden'));
        
        const currentStepEl = document.getElementById(`step-${currentStep}`);
        if (currentStepEl) currentStepEl.classList.remove('hidden');

        if (btnVoltar) btnVoltar.disabled = (currentStep === 1);
        if (btnAvancar) btnAvancar.innerText = (currentStep === totalSteps) ? "Concluir" : "Avançar";
    }

    function atualizarNomesPreview() {
        if (!inputSeuNome || !inputAmorNome || !previewCasal) return;
        const seuNome = inputSeuNome.value.trim();
        const amorNome = inputAmorNome.value.trim();
        
        if (seuNome && amorNome) {
            previewCasal.innerText = `${seuNome} & ${amorNome}`;
        } else if (seuNome || amorNome) {
            previewCasal.innerText = seuNome || amorNome;
        } else {
            previewCasal.innerText = "Gabriel & Mariana"; 
        }
    }

    function resetarContadorPreview() {
        atualizarContadorDOM(0, 0, 0, 0);
    }

    function padZero(num) {
        return String(num).padStart(2, '0');
    }

    function atualizarContadorDOM(d, h, m, s) {
        const previewContador = document.getElementById('preview-contador');
        if (!previewContador) return;
        
        previewContador.innerHTML = `
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${padZero(d)}</span><span class="text-[7px] uppercase text-neutral-400">Dias</span></div>
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${padZero(h)}</span><span class="text-[7px] uppercase text-neutral-400">Horas</span></div>
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-white">${padZero(m)}</span><span class="text-[7px] uppercase text-neutral-400">Min</span></div>
            <div class="bg-neutral-900/60 p-1.5 rounded-lg"><span class="block font-extrabold text-[#1ED760] animate-pulse">${padZero(s)}</span><span class="text-[7px] uppercase text-neutral-400">Seg</span></div>
        `;
    }

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

    function renderizarResultadosSpotify(tracks) {
        if (!listaResultadosMusica) return;
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

            item.addEventListener('click', async () => {
                const termoBuscaYT = `${nomeMusica} ${artista} official audio`;
                
                if (inputNomeMusica) {
                    inputNomeMusica.value = `${nomeMusica} - ${artista}`;
                    // GATILHO CORRIGIDO: Força o disparo do evento 'input' para atualizar o mockup na hora!
                    inputNomeMusica.dispatchEvent(new Event('input'));
                }

                // Mapeamento duplo para cobrir qualquer variação de ID usada no mockup do HTML
                const elementoNomePreview = document.getElementById('preview-nome-musica');
                const elementoArtistaPreview = document.getElementById('preview-artista-musica');
                const elementoCapaPreview = document.getElementById('preview-capa-musica');
                const elementoTrackName = document.getElementById('preview-track-name');

                if (elementoNomePreview) elementoNomePreview.textContent = nomeMusica;
                if (elementoTrackName) elementoTrackName.textContent = `${nomeMusica} - ${artista}`;
                if (elementoArtistaPreview) elementoArtistaPreview.textContent = artista;
                
                if (elementoCapaPreview && track.album.images[0]?.url) {
                    elementoCapaPreview.src = track.album.images[0].url;
                }
                
                listaResultadosMusica.classList.add('hidden');
                if (inputBuscaMusica) inputBuscaMusica.value = '';

                try {
                    const urlAPI = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(termoBuscaYT)}&type=video&videoEmbeddable=true&key=${YOUTUBE_API_KEY}&maxResults=5`;
                    const res = await fetch(urlAPI);
                    if (!res.ok) throw new Error(`Erro na API Oficial: ${res.status}`);

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
                    alert("Falha ao sincronizar o áudio. Verifique se a sua chave (API Key) do YouTube está correta.");
                }
            });
            listaResultadosMusica.appendChild(item);
        });

        listaResultadosMusica.classList.remove('hidden');
    }

    function carregarYoutubePlayerInvisivel(videoId) {
        if (ytPlayerObjeto && typeof ytPlayerObjeto.loadVideoById === 'function') {
            ytPlayerObjeto.loadVideoById(videoId);
            return;
        }

        let containerFalso = document.getElementById('yt-player-invisivel-container');
        if (!containerFalso) {
            containerFalso = document.createElement('div');
            containerFalso.id = 'yt-player-invisivel-container';
            containerFalso.style.position = 'fixed';
            containerFalso.style.bottom = '10px';
            containerFalso.style.right = '10px';
            containerFalso.style.width = '200px';
            containerFalso.style.height = '200px';
            containerFalso.style.zIndex = '-1';
            containerFalso.style.pointerEvents = 'none';
            containerFalso.style.opacity = '0.01';
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

    function criarObjetoYTPlayer(videoId) {
        if (typeof YT === 'undefined' || !YT.Player) return;
        ytPlayerObjeto = new YT.Player('yt-iframe-placeholder', {
            height: '100%', width: '100%', videoId: videoId, 
            playerVars: {
                'enablejsapi': 1, 'origin': window.location.origin, 
                'playsinline': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'rel': 0, 'modestbranding': 1
            },
            events: {
                'onReady': () => alternarVisualBotao(false),
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.PLAYING) alternarVisualBotao(true);
                    else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) alternarVisualBotao(false);
                }
            }
        });
    }

    // --- Vinculação de Eventos (Event Listeners) ---
    
    if (btnAvancar) {
        btnAvancar.addEventListener('click', async () => {
            if (currentStep < totalSteps) {
                currentStep++;
                updateSteps();
            } else {
                if (!inputSeuNome.value.trim() || !inputAmorNome.value.trim() || !inputData.value) {
                    alert("Por favor, preencha pelo menos os nomes e a data antes de concluir!");
                    return;
                }

                try {
                    btnAvancar.disabled = true;
                    btnAvancar.innerText = "Processando...";

                    const files = inputFotos ? inputFotos.files : [];
                    const fotosUrlsSalvas = [];

                    if (files.length > 0) {
                        const maxFotos = Math.min(files.length, 5);
                        for (let i = 0; i < maxFotos; i++) {
                            const file = files[i];
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
                            const filePath = `capas/${fileName}`;

                            let { error: uploadError } = await supabaseClient.storage.from('fotos-presentes').upload(filePath, file);
                            if (uploadError) throw uploadError;

                            const { data: publicUrlData } = supabaseClient.storage.from('fotos-presentes').getPublicUrl(filePath);
                            fotosUrlsSalvas.push(publicUrlData.publicUrl);
                        }
                    }

                    const dadosDoPresente = {
                        seu_nome: inputSeuNome.value.trim(),
                        amor_nome: inputAmorNome.value.trim(),
                        data_inicio: new Date(inputData.value).toISOString(),
                        titulo: inputTitulo.value.trim() || "Nossa Playlist de Amor",
                        musica_url: musicaSelecionadaDados.youtube_busca_termo || "", 
                        nome_musica: inputNomeMusica.value.trim() || "Nossa Música",
                        mensagem: inputMensagem.value.trim(),
                        fotos_urls: fotosUrlsSalvas 
                    };

                    const { data, error } = await supabaseClient.from('presentes').insert([dadosDoPresente]).select();
                    if (error) throw error;

                    if (data && data[0]) {
                        window.location.href = `planos.html?id=${data[0].id}`;
                    } else {
                        throw new Error("Falha na persistência.");
                    }
                } catch (error) {
                    console.error("Erro crítico:", error);
                    alert("Houve um erro ao salvar o seu presente. Tente novamente.");
                    btnAvancar.disabled = false;
                    btnAvancar.innerText = "Concluir";
                }
            }
        });
    }

    if (inputFotoCapaHistoria) {
    inputFotoCapaHistoria.addEventListener('change', (e) => {
        const file = e.target.files[0];
        
        // Diagnóstico 1: Verifica se o arquivo foi pego corretamente
        if (!file) return;

        // Diagnóstico 2: Busca o elemento do mockup novamente para garantir que ele existe na tela
        const fotoMockup = document.getElementById('preview-capa-historia');
        
        if (!fotoMockup) {
            console.error("ERRO: O JavaScript não encontrou nenhuma tag no HTML com o id='preview-capa-historia'");
            alert("Erro interno: Tag de imagem do mockup não foi encontrada. Verifique os IDs no HTML.");
            return;
        }

        // Se passou nos testes, faz a troca da imagem
        const reader = new FileReader();
        reader.onload = (event) => {
            fotoMockup.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
} else {
    console.error("ERRO: O JavaScript não encontrou o campo de upload com o id='input-foto-capa-historia'");
}
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateSteps();
            }
        });
    }

    if (btnPrevia && previewSection) {
        btnPrevia.addEventListener('click', () => previewSection.scrollIntoView({ behavior: 'smooth' }));
    }

    if (btnPlayPause) {
        btnPlayPause.addEventListener('click', () => {
            if (!ytPlayerObjeto || typeof ytPlayerObjeto.getPlayerState !== 'function') return;
            const estadoAtual = ytPlayerObjeto.getPlayerState();
            if (estadoAtual === 1) {
                ytPlayerObjeto.pauseVideo();
            } else {
                ytPlayerObjeto.playVideo();
            }
        });
    }

    if (inputSeuNome) inputSeuNome.addEventListener('input', atualizarNomesPreview);
    if (inputAmorNome) inputAmorNome.addEventListener('input', atualizarNomesPreview);

    if (inputTitulo && previewTituloTop) {
        inputTitulo.addEventListener('input', () => previewTituloTop.innerText = inputTitulo.value.trim() || "Nossa Playlist de Amor");
    }

    if (inputMensagem && previewMensagem) {
        inputMensagem.addEventListener('input', () => previewMensagem.innerText = inputMensagem.value.trim() ? inputMensagem.value.trim() : `"Sua mensagem carinhosa aparecerá bem aqui..."`);
    }

    if (inputNomeMusica && previewTrackName) {
        inputNomeMusica.addEventListener('input', () => previewTrackName.innerText = inputNomeMusica.value.trim() || "Nossa Playlist de Amor");
    }

    if (inputBuscaMusica) {
        inputBuscaMusica.addEventListener('input', () => {
            clearTimeout(timeoutDebounceBusca);
            const termo = inputBuscaMusica.value.trim();
            
            if (termo.length < 2) {
                if (listaResultadosMusica) listaResultadosMusica.classList.add('hidden');
                return;
            }

            timeoutDebounceBusca = setTimeout(async () => {
                try {
                    const token = await obterSpotifyToken();
                    if (!token) return;

                    const urlBusca = `https://api.spotify.com/v1/search?q=$${encodeURIComponent(termo)}&type=track&limit=5`;
                    const res = await fetch(urlBusca, { headers: { 'Authorization': `Bearer ${token}` } });
                    const data = await res.json();
                    
                    if (data.tracks && data.tracks.items) renderizarResultadosSpotify(data.tracks.items);
                } catch (err) {
                    console.error("Erro na busca Spotify:", err);
                }
            }, 400);
        });
    }

    if (inputData) {
        inputData.addEventListener('input', () => {
            if (!inputData.value) {
                clearInterval(intervaloCronometro);
                resetarContadorPreview();
                return;
            }

            clearInterval(intervaloCronometro);

            intervaloCronometro = setInterval(() => {
                const agora = new Date();
                const inicioCasal = new Date(inputData.value);
                let diferencaMili = agora - inicioCasal;

                if (diferencaMili < 0) {
                    resetarContadorPreview();
                    return;
                }

                const dias = Math.floor(diferencaMili / (1000 * 60 * 60 * 24));
                const horas = Math.floor((diferencaMili % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutos = Math.floor((diferencaMili % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diferencaMili % (1000 * 60)) / 1000);

                // Variável corrigida de "minutes" para "minutos"
                atualizarContadorDOM(dias, horas, minutos, segundos);
            }, 1000);
        });
    }

    if (inputFotos) {
        inputFotos.addEventListener('change', (e) => {
            const files = Array.from(e.target.files).slice(0, 5);
            
            if (files.length === 0) {
                if (previewFotoPlaceholder) previewFotoPlaceholder.classList.remove('hidden');
                if (carouselContainer) carouselContainer.classList.add('hidden');
                if (carouselDots) carouselDots.classList.add('hidden');
                return;
            }

            if (carouselContainer) carouselContainer.innerHTML = '';
            if (carouselDots) carouselDots.innerHTML = '';
            
            if (previewFotoPlaceholder) previewFotoPlaceholder.classList.add('hidden');
            if (carouselContainer) carouselContainer.classList.remove('hidden');
            if (carouselDots) carouselDots.classList.remove('hidden');

            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgDiv = document.createElement('div');
                    imgDiv.className = "w-full h-full flex-shrink-0 snap-start select-none";
                    imgDiv.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover pointer-events-none">`;
                    if (carouselContainer) carouselContainer.appendChild(imgDiv);

                    const dot = document.createElement('span');
                    dot.id = `dot-${index}`;
                    dot.className = `h-2 rounded-full transition-all duration-300 ${index === 0 ? 'bg-white w-4' : 'bg-white/40 w-2'}`;
                    if (carouselDots) carouselDots.appendChild(dot);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    if (carouselContainer && carouselDots) {
        carouselContainer.addEventListener('scroll', () => {
            const width = carouselContainer.offsetWidth;
            const activeIndex = Math.round(carouselContainer.scrollLeft / width);
            
            const dots = carouselDots.querySelectorAll('span');
            dots.forEach((dot, idx) => {
                dot.className = `h-2 rounded-full transition-all duration-300 ${idx === activeIndex ? 'bg-white w-4' : 'bg-white/40 w-2'}`;
            });
        });
    }

    // Inicialização da interface
    updateSteps();
    atualizarNomesPreview();
});