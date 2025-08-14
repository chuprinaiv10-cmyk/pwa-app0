// app.js

// Конфигурация localforage для хранения данных
localforage.config({ name: 'pwa-db' });

// Создаем экземпляр Vue.js
const app = new Vue({
    el: '#app',
    data: {
        // Переменная для отслеживания текущего вида (tasks, editTask, settings)
        currentView: 'tasks',
        // Массив для хранения данных о заданиях
        documents: [], 
        // Экземпляр Tabulator для списка заданий
        table: null,
        // Объект для хранения настроек приложения
        settings: {
            apiProductionTasks: '',
            apiTaskCompletion: '',
            username: '',
            token: ''
        },
        // Статистика локальной БД
        dbStats: {},
        // Массив для хранения номенклатуры
        nomenclature: [],
        
        // Переменные для редактирования документа
        editingTask: null,
        consumptionTable: null,
        productionTable: null
    },
    mounted() {
        // Хук mounted вызывается один раз после загрузки DOM
        this.$nextTick(async () => {
            console.log('Приложение Vue запущено');
            // Асинхронная инициализация, загрузка данных и настроек
            await this.initApp(); 
            this.initTable();
            this.loadData();
        });
    },
    methods: {
        // Метод для стартовой инициализации приложения
        async initApp() {
            // Загрузка настроек из локальной БД. Если пусто, используем значения по умолчанию.
            this.settings = await localforage.getItem('settings') || {
                apiProductionTasks: 'https://your-erp.com/api/production-tasks',
                apiTaskCompletion: 'https://your-erp.com/api/task-completion',
                username: 'user',
                token: 'YOUR_TOKEN'
            };
            // Загрузка номенклатуры и заданий
            this.nomenclature = await localforage.getItem('nomenclature') || [];
            this.documents = await localforage.getItem('documents') || [];
            console.log('Настройки и данные инициализированы');
        },
        
        // Инициализация таблицы для списка заданий
        initTable() {
            // Проверяем, существует ли DOM-элемент для таблицы
            if (document.getElementById('document-table')) {
                this.table = new Tabulator("#document-table", {
                    data: this.documents,
                    layout: "fitColumns",
                    columns: [
                        // Столбец ID. cellClick обрабатывает нажатие на ячейку для редактирования.
                        {title: "ID", field: "id-erp", width: 50, cellClick: (e, cell) => this.editDocument(cell.getRow().getData())},
                        // Столбец Название с фильтром
                        {title: "Название", field: "number", headerFilter: "input", headerFilterPlaceholder: "Фильтр..."},
                        // Столбец Дата с фильтром
                        {title: "Дата", field: "date", headerFilter: "input", headerFilterPlaceholder: "Фильтр..."},
                        // Столбец Статус с фильтром
                        {title: "Статус", field: "status", headerFilter: "input", headerFilterPlaceholder: "Фильтр..."},
                    ],
                });
                console.log('Таблица заданий инициализирована');
            }
        },

        // Загрузка данных из локальной БД
        async loadData() {
            // Загружаем данные из localforage
            this.documents = await localforage.getItem('documents') || [];
            if (this.documents.length === 0) {
                // Если данных нет, загружаем тестовые из JSON
                console.log('Локальная БД пуста, загружаем данные из JSON');
                await this.loadFromJson();
            }
            // Обновляем данные в таблице, если она существует
            if (this.table) {
                this.table.replaceData(this.documents);
                console.log('Данные загружены в таблицу');
            }
        },

        // Метод для загрузки данных из JSON-файлов
        async loadFromJson() {
            try {
                const nomenclature = await fetch('/data/nomenclature.json').then(response => response.json());
                const tasks = await fetch('/data/tasks.json').then(response => response.json());
                
                await localforage.setItem('nomenclature', nomenclature);
                await localforage.setItem('documents', tasks);
                
                this.nomenclature = nomenclature;
                this.documents = tasks;
                
                console.log('Данные успешно загружены из JSON.');
            } catch (error) {
                alert('Ошибка загрузки данных из JSON: ' + error.message);
                console.error(error);
            }
        },
        
        // Метод для загрузки данных с сервера через веб-сервис
        async loadDataFromServer() {
            try {
                const response = await fetch(this.settings.apiProductionTasks, {
                    headers: {
                        'Authorization': `Bearer ${this.settings.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP! Статус: ${response.status}`);
                }
                const data = await response.json();
                this.documents = data.tasks;
                await localforage.setItem('documents', this.documents);
                if (this.table) {
                    this.table.replaceData(this.documents);
                }
                alert('Данные с сервера успешно загружены');
            } catch (error) {
                alert(`Ошибка загрузки данных с сервера: ${error.message}`);
                console.error(error);
            }
        },
        
        // Механизм обращения к серверу при подтверждении документа
        async sendDocumentCompletion(documentData) {
            try {
                const response = await fetch(this.settings.apiTaskCompletion, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.settings.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(documentData)
                });

                if (!response.ok) {
                    throw new Error(`Ошибка HTTP! Статус: ${response.status}`);
                }

                const result = await response.json();
                alert(`Документ отправлен. Ответ сервера: ${result.status}`);
                return true;
            } catch (error) {
                alert(`Ошибка при отправке документа: ${error.message}`);
                console.error(error);
                return false;
            }
        },

        // Обработка клика по документу для его редактирования
        async editDocument(data) {
            this.editingTask = data;
            this.currentView = 'editTask';
            this.$nextTick(() => {
                this.initEditTables();
            });
        },

        // Инициализация таблиц для редактирования документа
        initEditTables() {
            if (document.getElementById('consumption-table')) {
                this.consumptionTable = new Tabulator("#consumption-table", {
                    data: this.editingTask.consumption,
                    layout: "fitColumns",
                    columns: [
                        {title: "Материал", field: "nomen-id-erp", width: 100},
                        {title: "План", field: "quant_plan"},
                        {title: "Факт", field: "quant_fact", editor: "input"},
                    ],
                });
            }
            if (document.getElementById('production-table')) {
                this.productionTable = new Tabulator("#production-table", {
                    data: this.editingTask.production,
                    layout: "fitColumns",
                    columns: [
                        {title: "Продукция", field: "nomen-id-erp", width: 100},
                        {title: "План", field: "quant_plan"},
                        {title: "Факт", field: "quant_fact", editor: "input"},
                    ],
                });
            }
        },

        // Метод для переключения между видами
        showView(view) {
            this.currentView = view;
            if (view === 'tasks') {
                // При возврате к "Заданиям" обновляем таблицу
                if (this.table) {
                    this.table.replaceData(this.documents);
                } else {
                    this.$nextTick(() => this.initTable());
                }
            } else if (view === 'settings') {
                this.getDbStats();
            }
        },
        
        // Метод для сохранения настроек
        async saveSettings() {
            await localforage.setItem('settings', this.settings);
            alert('Настройки сохранены');
        },
        
        // Получение статистики по локальной БД
        async getDbStats() {
            const stats = {};
            const keys = await localforage.keys();
            for (const key of keys) {
                const data = await localforage.getItem(key);
                if (Array.isArray(data)) {
                    stats[key] = data.length;
                } else {
                    stats[key] = 1;
                }
            }
            this.dbStats = stats;
        }
    }
});

