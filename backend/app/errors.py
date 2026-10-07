class EngineError(Exception):
    def __init__(self, code='ENGINE_UNAVAILABLE'):
        self.code = code
        super().__init__(code)


MESSAGES = {
    'AUTH_ERROR': 'Search provider configuration is unavailable.',
    'ALLOWANCE_UNAVAILABLE': 'Search allowance unavailable',
    'ENGINE_UNAVAILABLE': 'This search source is temporarily unavailable.',
    'INVALID_RESPONSE': 'This search source returned an unsupported response.',
}
