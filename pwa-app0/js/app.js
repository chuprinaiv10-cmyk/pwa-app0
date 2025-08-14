localforage.config({ name: 'pwa-db' });

const app = new Vue({
    el: '#app',
    data: {
        currentView: 'tasks',
        documents: [],
        table: null,
        apiProductionTasks: '',
        apiTaskCompletion: '',
        dbStats: {},
        // Добавлено поле для хранения значения штрих-кода
        barcode: '',
    },
    mounted() {
        // Инициализируем таблицу только после того, как Vue обновит DOM
        this.$nextTick(() => {
            this.initTable();
            this.loadData();
            this.loadSettings();
        });
    },
    methods: {
        initTable() {
            // Убедитесь, что элемент #document-table существует
            if (document.getElementById('document-table')) {
                this.table = new Tabulator("#document-table", {
                    data: this.documents,
                    layout: "fitColumns",
                    columns: [
                        {title: "ID", field: "id", width: 50, cellClick: (e, cell) => this.editDocument(cell.getRow().getData())},
                        {title: "Название", field: "name"},
                        {title: "Дата", field: "date"},
                    ],
                });
            }
        },
        async loadData() {
            this.documents = await localforage.getItem('documents') || [];
            if (this.documents.length === 0) {
                // Тестовые данные, если локальная БД пуста
                this.documents = [
                    { id: 1, name: "Документ 1", date: "2023-01-15" },
                    { id: 2, name: "Документ 2", date: "2023-02-20" },
                    { id: 3, name: "Документ 3", date: "2023-03-10" },
                ];
                // Сохраняем тестовые данные в LocalForage
                await localforage.setItem('documents', this.documents);
            }
            if (this.table) {
                this.table.replaceData(this.documents);
            }
        },
        editDocument(data) {
            // Заменяем alert() на консольный вывод, чтобы избежать блокировки
            console.log(`Редактирование документа с ID: ${data.id}`);
            // Здесь может быть переход на отдельный компонент для редактирования
        },
        showView(view) {
            this.currentView = view;
            if (view === 'settings') {
                this.getDbStats();
            }
        },
        async loadSettings() {
            const settings = await localforage.getItem('settings') || {
                apiProductionTasks: 'https://your-erp.com/api/production-tasks',
                apiTaskCompletion: 'https://your-erp.com/api/task-completion'
            };
            this.apiProductionTasks = settings.apiProductionTasks;
            this.apiTaskCompletion = settings.apiTaskCompletion;
        },
        async saveSettings() {
            await localforage.setItem('settings', {
                apiProductionTasks: this.apiProductionTasks,
                apiTaskCompletion: this.apiTaskCompletion
            });
            console.log('Настройки сохранены');
        },
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
        // Добавлен новый метод для обработки штрих-кода
        processBarcode() {
            if (this.barcode) {
                console.log(`Обработка штрих-кода: ${this.barcode}`);
                // Здесь будет ваша логика обработки штрих-кода
                this.barcode = ''; // Очищаем поле после обработки
            }
        }
    }
});
