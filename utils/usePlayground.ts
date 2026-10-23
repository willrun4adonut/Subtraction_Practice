export const usePlayground = () => {
  return {
    sdk: null,
    state: {},
    setState: () => {},
    isReady: true,
  };
};

export const usePlaygroundGameLifecycle = (_gameState: any, _sdk: any) => {};
