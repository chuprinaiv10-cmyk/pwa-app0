// localforage - это библиотека, которая упрощает работу с асинхронным хранилищем в браузере.
// Она использует IndexedDB, WebSQL или localStorage в зависимости от поддержки браузера.
localforage.config({ name: 'pwa-db' });

// Основной экземпляр Vue.js приложения.
const app = new Vue({
    // Элемент DOM, к которому привязывается Vue.
    el: '#app',
    
    // Объект данных, который доступен всем компонентам Vue.
    data: {
        currentView: 'tasks', // Текущий активный вид приложения. Варианты: 'tasks', 'documents', 'settings', 'dictionarys'.
        documents: [], // Массив для хранения данных документов.
        table: null, // Ссылка на экземпляр Tabulator для управления таблицей.
        apiProductionTasks: '', // URL для получения производственных задач.
        apiTaskCompletion: '', // URL для отправки данных о выполнении задач.
        dbStats: {}, // Статистика по локальной базе данных.
        barcode: '', // Поле для ввода или сканирования штрих-кода.
        initialData: null, // Переменная для хранения загруженных начальных данных из JSON.
        loading: false, // Флаг для отображения индикатора загрузки.
        message: '', // Сообщение для пользователя.
        currentDictionary: null, // Текущий выбранный справочник ('nomen', 'stor', 'users').
        dictionaryData: [], // Массив для хранения данных текущего справочника.
        // Заголовки для справочников для отображения в интерфейсе
        dictionaryTitles: {
            nomen: 'Номенклатура',
            stor: 'Склады',
            users: 'Пользователи'
        },
        // Определение колонок для каждого справочника
        dictionaryColumns: {
            nomen: [
                {field: "id", title: "ID"},
                {field: "id-erp", title: "ID-ERP"},
                {field: "name", title: "Название"},
                {field: "barcode", title: "Штрих-код"},
                {field: "serie", title: "Серия"}
            ],
            stor: [
                {field: "id-erp", title: "ID-ERP"},
                {field: "mnemo", title: "Мнемоника"},
                {field: "name", title: "Название"}
            ],
            users: [
                {field: "name", title: "Имя"},
                {field: "barcode", title: "Штрих-код"}
            ]
        }
    },

    // Хук жизненного цикла Vue. Вызывается после монтирования экземпляра.
    mounted() {
        this.$nextTick(() => {
            // Инициализация приложения при старте.
            this.initApp();
        });
    },

    watch: {
        // Следим за изменением выбранного справочника
        currentDictionary(newDictionary) {
            if (newDictionary) {
                this.loadDictionaryData(newDictionary);
            }
        }
    },

    // Методы, определяющие логику приложения.
    methods: {
        /**
         * Основной метод инициализации приложения.
         * Проверяет наличие данных в локальной БД. Если их нет, пытается загрузить из файла.
         */
        async initApp() {
            this.loading = true;
            this.message = 'Загрузка приложения...';
            try {
                // Проверяем, есть ли какие-либо ключи в LocalForage.
                const keys = await localforage.keys();
                if (keys.length === 0) {
                    console.log('Локальная БД пуста. Попытка загрузить начальные данные из файла.');
                    await this.loadInitialDataFromFile();
                } else {
                    console.log('Локальная БД уже содержит данные.');
                }
                
                // Запускаем инициализацию таблицы и загрузку данных для текущего вида.
                this.initTable();
                await this.loadData();
                await this.loadSettings();
                
                // Устанавливаем вид по умолчанию.
                this.showView('tasks');
                this.message = 'Готово.';
            } catch (error) {
                this.message = `Ошибка инициализации: ${error.message}`;
                console.error('Ошибка инициализации приложения:', error);
            } finally {
                this.loading = false;
            }
        },

        /**
         * Инициализирует Tabulator для отображения таблицы документов.
         * Добавлены настройки для улучшения отображения на мобильных устройствах.
         */
        initTable() {
            // Проверяем, существует ли элемент с ID 'document-table'.
            const tableElement = document.getElementById('document-table');
            if (tableElement) {
                this.table = new Tabulator(tableElement, {
                    data: this.documents,
                    // Используем "fitData" вместо "fitColumns" для предотвращения изменения ширины колонок.
                    // Теперь ширина колонок будет определяться на основе данных в них.
                    layout: "fitData",
                    // Адаптивный режим: скрывает колонки, которые не помещаются на экране,
                    // и отображает их по нажатию на "+" в начале строки.
                    responsiveLayout: "collapse",
                    columns: [
                        {title: "ID", field: "id", width: 50, cellClick: (e, cell) => this.editDocument(cell.getRow().getData())},
                        {title: "Название", field: "name"},
                        {title: "Дата", field: "date"},
                    ],
                });
            }
        },
        
        /**
         * Загружает начальные данные из JSON-файла.
         * Этот метод может быть использован для загрузки как начальных данных, так и данных с сервера.
         * @param {string} filePath - Путь к JSON-файлу.
         */
        async loadInitialDataFromFile(filePath = 'data/initial.json') {
            try {
                this.message = 'Загрузка данных из файла...';
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`Не удалось загрузить файл ${filePath}. Статус: ${response.status}`);
                }
                const data = await response.json();
                this.initialData = data;
                
                // Сохраняем данные в локальное хранилище.
                await this.saveDataToLocalForage(data);
                this.message = 'Данные успешно загружены и сохранены.';
                
            } catch (error) {
                this.message = `Ошибка загрузки файла: ${error.message}`;
                console.error('Ошибка загрузки начальных данных:', error);
            } finally {
                this.loading = false;
            }
        },
        
        /**
         * Сохраняет данные из JSON-объекта в LocalForage.
         * @param {object} data - Объект данных в формате JSON.
         */
        async saveDataToLocalForage(data) {
            // Сохраняем настройки
            if (data.settings) {
                await localforage.setItem('settings', data.settings);
            }
            
            // Сохраняем каждую таблицу
            if (data.tables) {
                for (const tableKey in data.tables) {
                    if (data.tables.hasOwnProperty(tableKey)) {
                        await localforage.setItem(tableKey, data.tables[tableKey]);
                    }
                }
            }
        },

        /**
         * Загружает данные документов из LocalForage и обновляет таблицу.
         */
        async loadData() {
            this.documents = await localforage.getItem('doc') || [];
            if (this.documents.length === 0) {
                 // Загружаем тестовые данные, если документ doc отсутствует
                this.documents = [
                    { id: 1, name: "Документ 1", date: "2023-01-15" },
                    { id: 2, name: "Документ 2", date: "2023-02-20" },
                    { id: 3, name: "Документ 3", date: "2023-03-10" },
                ];
            }
            if (this.table) {
                this.table.replaceData(this.documents);
            }
        },
        
        /**
         * Обработчик клика по документу в таблице.
         * @param {object} data - Данные выбранного документа.
         */
        editDocument(data) {
            // Используем console.log вместо alert для неблокирующего вывода.
            console.log(`Редактирование документа с ID: ${data.id}`);
        },

        /**
         * Переключает текущий вид приложения.
         * @param {string} view - Название вида ('tasks', 'documents', 'settings', 'dictionarys').
         */
        showView(view) {
            this.currentView = view;
            if (view === 'settings') {
                this.getDbStats();
            }
        },

        /**
         * Метод для отображения выбранного справочника.
         * @param {string} dictName - Имя справочника ('nomen', 'stor', 'users').
         */
        showDictionary(dictName) {
            this.currentDictionary = dictName;
        },

        /**
         * Загружает данные для выбранного справочника и отображает их в таблице.
         * Теперь используется простая HTML-таблица, а не Tabulator.
         * @param {string} dictName - Имя справочника.
         */
        async loadDictionaryData(dictName) {
            this.loading = true;
            this.message = `Загрузка данных справочника "${this.dictionaryTitles[dictName]}"...`;
            try {
                // Получаем данные из LocalForage
                this.dictionaryData = await localforage.getItem(dictName) || [];
                // Убираем старую таблицу Tabulator, так как она больше не нужна
                if (this.dictionaryTable) {
                    this.dictionaryTable.destroy();
                    this.dictionaryTable = null;
                }
                this.message = 'Готово.';
            } catch (error) {
                this.message = `Ошибка загрузки справочника: ${error.message}`;
                console.error('Ошибка загрузки справочника:', error);
            } finally {
                this.loading = false;
            }
        },

        /**
         * Загружает настройки из LocalForage.
         */
        async loadSettings() {
            const settings = await localforage.getItem('settings') || {
                apiProductionTasks: 'https://your-erp.com/api/production-tasks',
                apiTaskCompletion: 'https://your-erp.com/api/task-completion'
            };
            this.apiProductionTasks = settings.apiProductionTasks;
            this.apiTaskCompletion = settings.apiTaskCompletion;
        },

        /**
         * Сохраняет настройки в LocalForage.
         */
        async saveSettings() {
            await localforage.setItem('settings', {
                apiProductionTasks: this.apiProductionTasks,
                apiTaskCompletion: this.apiTaskCompletion
            });
            console.log('Настройки сохранены');
        },

        /**
         * Собирает статистику по всем таблицам в LocalForage.
         */
        async getDbStats() {
            const stats = {};
            const keys = await localforage.keys();
            for (const key of keys) {
                const data = await localforage.getItem(key);
                if (Array.isArray(data)) {
                    stats[key] = data.length;
                } else {
                    stats[key] = 1; // Например, для настроек
                }
            }
            this.dbStats = stats;
        },
        
        /**
         * Обрабатывает введенный штрих-код.
         */
        processBarcode() {
            if (this.barcode) {
                console.log(`Обработка штрих-кода: ${this.barcode}`);
                // Здесь будет ваша логика обработки штрих-кода
                this.barcode = ''; // Очищаем поле после обработки
            }
        }
    }
});
