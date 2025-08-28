// localforage - это библиотека, которая упрощает работу с асинхронным хранилищем в браузере.
// Она использует IndexedDB, WebSQL или localStorage в зависимости от поддержки браузера.
localforage.config({ name: 'pwa-db' });

// Основной экземпляр Vue.js приложения.
const app = new Vue({
    // Элемент DOM, к которому привязывается Vue.
    el: '#app',
    
    // Объект данных, который доступен всем компонентам Vue.
    data: {
        currentView: 'doclist', // Текущий активный вид приложения. Варианты: 'tasks', 'doclist', 'settings', 'dictionarys'.
        documents: [], // Массив для хранения данных документов.
        docListColumns: [
            { field: 'doc_type', title: 'Тип' },
            { field: 'id-erp', title: 'ID-ERP' },
            { field: 'name', title: 'Название' },
            { field: 'consumption_count', title: 'Списано' },
            { field: 'production_count', title: 'Произведено' },
            { field: 'date', title: 'Дата' }
        ], // Массив для хранения данных документов.
        currentDoc: null, // Объект для хранения текущего документа.
        nomenclatures: [], // Cвойство для хранения справочника номенклатуры.
        table: null, // Ссылка на экземпляр Tabulator для управления таблицей.
        apiProductionTasks: '', // URL для получения производственных задач.
        apiTaskCompletion: '', // URL для отправки данных о выполнении задач.
        dbStats: {}, // Статистика по локальной базе данных.
        barcode: '', // Поле для ввода или сканирования штрих-кода.
        initialData: null, // Переменная для хранения загруженных начальных данных из JSON.
        loading: false, // Флаг для отображения индикатора загрузки.
        message: '', // Сообщение для пользователя.
        toastMessage: '', // Всплывающие сообщения
        showModal: false, // Изменим на boolean
        modalMessage: '',
        modalType: '',
        modalCallback: null,
        modalForm: [], // Новый массив для хранения полей формы
        modalFormData: {} // Новый объект для хранения введенных данных
        currentDictionary: 'nomen', //null, // Текущий выбранный справочник ('nomen', 'stor', 'users').
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

    // Вычисляемые свойства.
    computed: {
        // Создаем вычисляемое свойство, которое преобразует массив номенклатур
        // в объект для быстрого доступа по id-erp.
        nomenclaturesById() {
            return this.nomenclatures.reduce((acc, nomen) => {
                acc[nomen['id']] = nomen.name;
                return acc;
            }, {});
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
        },
        // Новое: Отслеживаем изменение текущего вида для инициализации таблиц
        currentView(newView) {
            if (newView === 'documents') {
                //this.initTable();
                this.loadData();
                this.loadNomenclatures();
            } else if (newView === 'tasks') {
                // Заглушка Инициализация таблицы задач при переключении на "Задачи"
                //this.initTasksTable();
                //this.loadTasks();
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
                //this.initTable(); // переносим в watch
                await this.loadData();
                await this.loadNomenclatures();
                await this.loadSettings();
                
                // Устанавливаем вид по умолчанию.
                this.showView('doclist');
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
         * Загружает данные документов doc из LocalForage и обновляет таблицу.
         */
        async loadData() {
            this.documents = await localforage.getItem('doc') || [];
            if (this.documents.length === 0) {
                 // Загружаем тестовые данные, если документ doc отсутствует
                this.documents = [
                    { "id-erp": "D001", "doc_type": "Приемка", "name": "Поступление от поставщика", "date": "2023-11-20", "consumption": [], "production": [{ "id-nomen": "N001", "quant_plan": 5, "quant_fact": 5 }] },
                    { "id-erp": "D002", "doc_type": "Производство", "name": "Производство готовой продукции", "date": "2023-11-21", "consumption": [{ "id-nomen": "N002", "quant_plan": 10, "quant_fact": 8 }], "production": [{ "id-nomen": "N003", "quant_plan": 10, "quant_fact": 8 }] },
                    { "id-erp": "D003", "doc_type": "Отгрузка", "name": "Отгрузка клиенту", "date": "2023-11-22", "consumption": [{ "id-nomen": "N004", "quant_plan": 15, "quant_fact": 15 }], "production": [] },
                ];
            }
            //убрал загрузку табулатор
            //if (this.table) {
            //    this.table.replaceData(this.documents);
            //}
        },

        // Загрузка справочника номенклатуры
        async loadNomenclatures() {
            try {
                this.nomenclatures = await localforage.getItem('nomen') || [];
                 // Если справочник пуст, загружаем тестовые данные.
                if (this.nomenclatures.length === 0) {
                     this.nomenclatures = [
                        { "id-erp": "N001", "name": "Тестовый товар 1" },
                        { "id-erp": "N002", "name": "Тестовый товар 2" },
                        { "id-erp": "N003", "name": "Тестовый товар 3" },
                        { "id-erp": "N004", "name": "Тестовый товар 4" }
                    ];
                }
            } catch (error) {
                console.error('Ошибка загрузки справочника номенклатуры:', error);
            }
        },
        
        /**
         * Обработчик клика по документу в таблице.
         * @param {object} data - Данные выбранного документа.
         */
        editDocument(data) {
            // Присваиваем выбранный документ реактивному свойству currentDoc.
            this.currentDoc = data;
            console.log(`Редактирование документа с ID-ERP: ${this.currentDoc['id-erp']}`);
            this.showView('docedit');
            
        },

        /**
         * Обработчик клика по кнопке "создать операцию".
         * @param {object} data - Данные выбранного документа.
         */
        createOperation () {
            // Заглушка
            console.log(`Нажата кнопка Создания операции`);
            //this.showView('docedit');
            //this.showToast('Создание операции');
            const formFields = [
                { name: 'nomen_id', label: 'ID Номенклатуры', type: 'text' },
                { name: 'quantity', label: 'Количество', type: 'number', value: 1 },
                { name: 'operation_type', label: 'Тип операции', type: 'select', options: ['production', 'consumption'] }
            ];

            this.showModalWithForm(
                'Введите данные для новой операции:',
                'prompt',
                formFields,
                (data) => {
                if (data) {
                    console.log('Данные формы:', data);
                    // Здесь будет ваша логика обработки данных формы
                }
                this.showModal = false;
                }
            );
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
        },
        // Метод для отображения всплывающего сообщения
        showToast(message = this.toastMessage) {
            this.toastMessage = message;
            const toast = document.getElementById('toast');
            if (toast) {
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                    this.toastMessage = '';
                }, 3000); // Сообщение исчезает через 3 секунды
            }
        },
        /**
         * Отображает модальное окно с формой.
         * @param {string} message Сообщение для модального окна.
         * @param {string} type Тип модального окна ('prompt' или 'confirm').
         * @param {Array<Object>} formFields Массив объектов полей формы.
         * @param {function} callback Колбэк-функция, которая будет вызвана при закрытии.
        */
        showModalWithForm(message, type, formFields, callback) {
            this.modalMessage = message;
            this.modalType = type;
            this.modalForm = formFields;
            this.modalFormData = {}; // Очищаем данные формы
            // Заполняем modalFormData значениями по умолчанию
            this.modalForm.forEach(field => {
                this.$set(this.modalFormData, field.name, field.value || null);
            });
            this.modalCallback = callback;
            this.showModal = true;
        },

        // Метод для закрытия модального окна
        closeModal() {
            this.showModal = '';
        }
    }
});
